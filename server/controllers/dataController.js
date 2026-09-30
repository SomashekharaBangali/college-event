import {
  createBooking,
  createRecord,
  deleteRecord,
  findUserByEmail,
  getWorkbookData,
  updateRecord,
  workbookSheets,
} from '../utils/workbookStore.js';
import { publishCampusUpdate } from '../utils/realtime.js';

const publicSheets = new Set(workbookSheets.filter((sheet) => sheet !== 'Users'));

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function forbidden(message = 'You do not have permission to change this record.') {
  const error = new Error(message);
  error.status = 403;
  return error;
}

async function canManageClub(user, clubId, data) {
  if (user.role === 'admin') return true;
  const club = data.Clubs.find((record) => record.id === clubId);
  if (!club) return false;
  return club.createdBy === user.email
    || data.Committee.some((member) => member.clubId === clubId && member.email === user.email);
}

function normalizeRecord(sheet, body, user) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Enter valid record details.');
  switch (sheet) {
    case 'Clubs': {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name.length < 2 || name.length > 80) throw badRequest('Club name must be between 2 and 80 characters.');
      return { name, description: String(body.description || '').trim().slice(0, 500), department: String(body.department || '').trim().slice(0, 80), createdBy: user.email };
    }
    case 'Events': {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const price = Number(body.price);
      const capacity = Number(body.capacity);
      const start = new Date(body.startsAt);
      if (title.length < 2 || title.length > 100) throw badRequest('Event title must be between 2 and 100 characters.');
      if (!Number.isFinite(price) || price < 0 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100_000) throw badRequest('Enter a valid event price and capacity.');
      if (Number.isNaN(start.getTime())) throw badRequest('Enter a valid event date and time.');
      return {
        title,
        clubId: String(body.clubId || ''),
        description: String(body.description || '').trim().slice(0, 1000),
        location: String(body.location || '').trim().slice(0, 120),
        startsAt: start,
        price,
        capacity,
        createdBy: user.email,
      };
    }
    case 'Contacts': {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Enter a contact name and valid email.');
      return { name, email, phone: String(body.phone || '').trim().slice(0, 32), organization: String(body.organization || '').trim().slice(0, 100), role: String(body.role || '').trim().slice(0, 80), createdBy: user.email };
    }
    case 'Committee': {
      const clubId = String(body.clubId || '');
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!clubId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Choose a club and enter a valid committee email.');
      return { clubId, email, role: String(body.role || 'Committee member').trim().slice(0, 80) };
    }
    case 'Announcements': {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (title.length < 2 || title.length > 100 || message.length < 2 || message.length > 3000) throw badRequest('Enter an announcement title and message.');
      return { title, message, audience: 'college', createdBy: user.email };
    }
    default:
      throw badRequest('This record type cannot be created here.');
  }
}

export async function listData(_request, response, next) {
  try {
    const { Users: _users, ...campusData } = await getWorkbookData();
    response.json(campusData);
  } catch (error) {
    next(error);
  }
}

export async function addData(request, response, next) {
  try {
    const { sheet } = request.params;
    if (!publicSheets.has(sheet)) throw badRequest('Unknown campus data section.');
    const values = normalizeRecord(sheet, request.body, request.user);
    const data = await getWorkbookData();

    if (sheet === 'Events' && values.clubId) {
      if (!await canManageClub(request.user, values.clubId, data)) throw forbidden('Only a club organizer can publish its event.');
    }
    if (sheet === 'Contacts' && values.email === request.user.email) throw badRequest('Use a different email for this contact.');

    if (sheet === 'ClubMembers') {
      throw badRequest('Membership requests use the dedicated join route.');
    }
    if (sheet === 'Bookings') {
      throw badRequest('Event bookings use the dedicated booking route.');
    }
    if (sheet === 'Committee') {
      const clubId = values.clubId;
      if (!await canManageClub(request.user, clubId, data)) throw forbidden('Only a club organizer can manage its committee.');
      const candidate = await findUserByEmail(values.email);
      if (!candidate) throw badRequest('Committee members must first create a campus account.');
      values.name = candidate.name;
      values.email = candidate.email;
      if (data.Committee.some((member) => member.clubId === clubId && member.email === candidate.email)) {
        return response.status(409).json({ message: 'This person is already on the committee.' });
      }
    }

    const record = await createRecord(sheet, values);
    publishCampusUpdate(request.io, request.user.email, { action: 'created', sheet, record });
    return response.status(201).json({ record });
  } catch (error) {
    return next(error);
  }
}

export async function joinClub(request, response, next) {
  try {
    const data = await getWorkbookData();
    const club = data.Clubs.find((record) => record.id === request.params.id);
    if (!club) throw badRequest('Club not found.');
    if (data.ClubMembers.some((member) => member.clubId === club.id && member.email === request.user.email)) {
      return response.status(409).json({ message: 'You already have a membership request for this club.' });
    }
    const record = await createRecord('ClubMembers', {
      clubId: club.id,
      name: request.user.name,
      email: request.user.email,
      role: 'Member',
      status: 'pending',
    });
    publishCampusUpdate(request.io, request.user.email, { action: 'created', sheet: 'ClubMembers', record });
    return response.status(201).json({ record });
  } catch (error) {
    return next(error);
  }
}

export async function bookEvent(request, response, next) {
  try {
    const guests = Number(request.body?.guests);
    if (!Number.isInteger(guests) || guests < 0 || guests > 10) throw badRequest('Guest count must be between zero and ten.');
    const data = await getWorkbookData();
    const event = data.Events.find((record) => record.id === request.params.id);
    if (!event) throw badRequest('Event not found.');
    const result = await createBooking({
      eventId: event.id,
      attendeeName: request.user.name,
      attendeeEmail: request.user.email,
      guests,
      paymentStatus: Number(event.price) > 0 ? 'Payment due' : 'Free',
    });
    if (result.status === 'duplicate') return response.status(409).json({ message: 'You already have a booking for this event.' });
    if (result.status === 'full') throw badRequest('There are not enough seats left for this booking.');
    if (result.status === 'missing') throw badRequest('Event not found.');
    const { record } = result;
    publishCampusUpdate(request.io, request.user.email, { action: 'created', sheet: 'Bookings', record });
    return response.status(201).json({ record, message: Number(event.price) > 0 ? 'Booking saved. Payment is not collected by this local app.' : 'Free booking saved.' });
  } catch (error) {
    return next(error);
  }
}

export async function changeData(request, response, next) {
  try {
    const { sheet, id } = request.params;
    if (!publicSheets.has(sheet)) throw badRequest('Unknown campus data section.');
    const data = await getWorkbookData();
    if (sheet === 'ClubMembers') {
      const member = data.ClubMembers.find((record) => record.id === id);
      if (!member) throw badRequest('Membership request not found.');
      if (!['approved', 'rejected'].includes(request.body?.status)) throw badRequest('Choose approve or reject.');
      if (!await canManageClub(request.user, member.clubId, data)) throw forbidden();
      const record = await updateRecord(sheet, id, { status: request.body.status });
      publishCampusUpdate(request.io, request.user.email, { action: 'updated', sheet, record });
      return response.json({ record });
    }
    if (sheet === 'Events') {
      const event = data.Events.find((record) => record.id === id);
      if (!event) throw badRequest('Event not found.');
      if (request.user.role !== 'admin' && event.createdBy !== request.user.email) throw forbidden();
      const record = await updateRecord(sheet, id, request.body);
      publishCampusUpdate(request.io, request.user.email, { action: 'updated', sheet, record });
      return response.json({ record });
    }
    throw forbidden();
  } catch (error) {
    return next(error);
  }
}

export async function removeData(request, response, next) {
  try {
    const { sheet, id } = request.params;
    if (sheet !== 'Contacts') throw forbidden();
    const data = await getWorkbookData();
    const contact = data.Contacts.find((record) => record.id === id);
    if (!contact) throw badRequest('Contact not found.');
    if (request.user.role !== 'admin' && contact.createdBy !== request.user.email) throw forbidden();
    await deleteRecord(sheet, id);
    publishCampusUpdate(request.io, request.user.email, { action: 'deleted', sheet, id });
    return response.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}