import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  ContactRound,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Plus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { bookCampusEvent, createCampusRecord, deleteCampusRecord, getCampusData, requestClubMembership, updateCampusRecord } from '../api/campusData.js';
import { connectLiveUpdates } from '../api/realtime.js';

const navigation = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'clubs', label: 'Clubs', Icon: UsersRound },
  { id: 'members', label: 'Club members', Icon: UsersRound },
  { id: 'events', label: 'Events & booking', Icon: CalendarDays },
  { id: 'announcements', label: 'Announcements', Icon: Megaphone },
  { id: 'bookings', label: 'My bookings', Icon: WalletCards },
  { id: 'participants', label: 'Participants', Icon: UsersRound },
  { id: 'committee', label: 'Organizers', Icon: ContactRound },
  { id: 'contacts', label: 'Contacts', Icon: ContactRound },
];

const emptyData = { Clubs: [], ClubMembers: [], Committee: [], Events: [], Bookings: [], Contacts: [], Announcements: [] };

function priceLabel(price) {
  const amount = Number(price) || 0;
  return amount > 0 ? `Payment due · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR' }).format(amount)}` : 'Free';
}

function dateLabel(value) {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function Field({ label, children }) {
  return <label className="dashboard-field"><span>{label}</span>{children}</label>;
}

function EmptyState({ children }) {
  return <p className="empty-state">{children}</p>;
}

export default function CampusDashboard({ user, onSignOut }) {
  const [activeView, setActiveView] = useState('overview');
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [clubFormOpen, setClubFormOpen] = useState(false);

  async function refreshData() {
    const workbookData = await getCampusData();
    setData(workbookData);
  }

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    getCampusData()
      .then((workbookData) => { if (isCurrent) setData(workbookData); })
      .catch((loadError) => { if (isCurrent) setError(loadError.message); })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    const socket = connectLiveUpdates();
    socket.on('connect', () => setIsLive(true));
    socket.on('disconnect', () => setIsLive(false));
    socket.on('campus:data_changed', async ({ sheet }) => {
      try {
        await refreshData();
        setNotice(`${sheet} updated live across campus.`);
      } catch (refreshError) {
        setError(refreshError.message);
      }
    });
    socket.on('connect_error', (socketError) => setError(socketError.message));
    return () => socket.disconnect();
  }, []);

  async function saveRecord(sheet, values, successMessage) {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      await createCampusRecord(sheet, values);
      await refreshData();
      setNotice(successMessage);
      return true;
    } catch (saveError) {
      setError(saveError.message);
      return null;
    } finally {
      setIsWorking(false);
    }
  }

  async function updateRecord(sheet, id, values, successMessage) {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      await updateCampusRecord(sheet, id, values);
      await refreshData();
      setNotice(successMessage);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function removeContact(id) {
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      await deleteCampusRecord('Contacts', id);
      await refreshData();
      setNotice('Contact removed.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCreateClub(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const club = await saveRecord('Clubs', {
      name: form.get('name').trim(),
      description: form.get('description').trim(),
      department: form.get('department').trim(),
      createdBy: user.email,
    }, 'Club created.');
    if (club) {
      setClubFormOpen(false);
      formElement.reset();
    }
  }

  async function joinClub(club) {
    if (data.ClubMembers.some((member) => member.clubId === club.id && member.email.toLowerCase() === user.email.toLowerCase())) {
      setError('You already have a membership request for this club.');
      return;
    }
    setError('');
    try {
      await requestClubMembership(club.id);
      await refreshData();
      setNotice('Join request saved. The club owner can approve it.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleAddCommittee(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const club = data.Clubs.find((item) => item.id === form.get('clubId'));
    if (!club || club.createdBy.toLowerCase() !== user.email.toLowerCase()) {
      setError('Only the club creator can manage its organizer committee.');
      return;
    }
    const result = await saveRecord('Committee', {
      clubId: club.id,
      name: form.get('name').trim(),
      email: form.get('email').trim().toLowerCase(),
      role: form.get('role'),
    }, 'Committee member added.');
    if (result) formElement.reset();
  }

  async function handleCreateEvent(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const price = Number(form.get('price'));
    const capacity = Number(form.get('capacity'));
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(capacity) || capacity < 1) {
      setError('Enter a valid ticket price and a capacity of at least one.');
      return;
    }
    const result = await saveRecord('Events', {
      title: form.get('title').trim(),
      clubId: form.get('clubId') || '',
      description: form.get('description').trim(),
      location: form.get('location').trim(),
      startsAt: form.get('startsAt'),
      price,
      capacity,
      createdBy: user.email,
    }, 'Event published.');
    if (result) formElement.reset();
  }

  async function bookEvent(eventRecord, event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const guests = Number(form.get('guests'));
    if (!Number.isInteger(guests) || guests < 0 || guests > 10) {
      setError('Guest count must be between zero and ten.');
      return;
    }
    if (data.Bookings.some((booking) => booking.eventId === eventRecord.id && booking.attendeeEmail.toLowerCase() === user.email.toLowerCase())) {
      setError('You already have a booking for this event.');
      return;
    }
    const attending = data.Bookings.filter((booking) => booking.eventId === eventRecord.id)
      .reduce((total, booking) => total + 1 + Number(booking.guests || 0), 0);
    if (attending + guests + 1 > Number(eventRecord.capacity)) {
      setError('There are not enough seats left for this booking.');
      return;
    }

    setError('');
    setIsWorking(true);
    try {
      const result = await bookCampusEvent(eventRecord.id, guests);
      await refreshData();
      setNotice(result.message);
      formElement.reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleAddContact(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await saveRecord('Contacts', {
      name: form.get('name').trim(),
      email: form.get('email').trim().toLowerCase(),
      phone: form.get('phone').trim(),
      organization: form.get('organization').trim(),
      role: form.get('role').trim(),
    }, 'Contact saved.');
    if (result) event.currentTarget.reset();
  }

  async function handleCreateAnnouncement(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await saveRecord('Announcements', {
      title: form.get('title').trim(),
      message: form.get('message').trim(),
    }, 'Announcement posted to your college feed.');
    if (result) formElement.reset();
  }

  function bookingCount(eventId) {
    return data.Bookings.filter((booking) => booking.eventId === eventId)
      .reduce((total, booking) => total + 1 + Number(booking.guests || 0), 0);
  }

  const activeNavigation = navigation.find((item) => item.id === activeView);
  const clubNames = new Map(data.Clubs.map((club) => [club.id, club.name]));
  const eventNames = new Map(data.Events.map((event) => [event.id, event.title]));
  const upcomingEvents = data.Events.filter((event) => !event.startsAt || new Date(event.startsAt) >= new Date());
  const myBookings = data.Bookings.filter((booking) => booking.attendeeEmail.toLowerCase() === user.email.toLowerCase());

  return (
    <main className="campus-app">
      <aside className="app-sidebar">
        <div className="app-brand"><span className="brand-mark">cc</span><span>campus connect</span></div>
        <div className="signed-in-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
        <nav className="app-navigation" aria-label="Campus features">
          {navigation.map(({ id, label, Icon }) => (
            <button key={id} type="button" className={activeView === id ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView(id); setError(''); setNotice(''); }}>
              <Icon size={17} aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><FileSpreadsheet size={15} aria-hidden="true" /><span>Shared Book2.xlsx</span></div>
        <button className="signout-button" type="button" onClick={onSignOut}><LogOut size={16} aria-hidden="true" />Sign out</button>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div><p className="eyebrow">CAMPUS CONNECT</p><h1>{activeNavigation?.label}</h1></div>
          <div className="topbar-meta"><span className={isLive ? 'live-status connected' : 'live-status'}><i />{isLive ? 'Live' : 'Reconnecting'}</span><span className="topbar-date">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
        </header>
        {(notice || error) && <div className={error ? 'dashboard-alert error-message' : 'dashboard-alert success-message'} role={error ? 'alert' : 'status'}>{error || notice}</div>}
        {isLoading ? <EmptyState>Loading workbook…</EmptyState> : (
          <div className="dashboard-content">
            {activeView === 'overview' && (
              <>
                <div className="metric-grid">
                  <div className="metric"><span>Clubs</span><strong>{data.Clubs.length}</strong></div>
                  <div className="metric"><span>Upcoming events</span><strong>{upcomingEvents.length}</strong></div>
                  <div className="metric"><span>My bookings</span><strong>{myBookings.length}</strong></div>
                  <div className="metric"><span>Club members</span><strong>{data.ClubMembers.length}</strong></div>
                </div>
                <section className="dashboard-section">
                  <div className="section-heading"><div><h2>Upcoming events</h2><p>What’s happening around campus</p></div><button className="quiet-action" type="button" onClick={() => setActiveView('events')}>Browse events</button></div>
                  {upcomingEvents.length === 0 ? <EmptyState>No events yet. Create the first campus event.</EmptyState> : (
                    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Event</th><th>Club</th><th>When</th><th>Entry</th></tr></thead><tbody>{upcomingEvents.slice(0, 6).map((event) => <tr key={event.id}><td><strong>{event.title}</strong></td><td>{clubNames.get(event.clubId) || 'Campus'}</td><td>{dateLabel(event.startsAt)}</td><td>{priceLabel(event.price)}</td></tr>)}</tbody></table></div>
                  )}
                </section>
                <section className="dashboard-section"><div className="section-heading"><div><h2>Quick actions</h2><p>Jump into the campus directory</p></div></div><div className="quick-actions"><button type="button" onClick={() => { setActiveView('clubs'); setClubFormOpen(true); }}><Plus size={16} />Create a club</button><button type="button" onClick={() => setActiveView('events')}><CalendarDays size={16} />Create an event</button><button type="button" onClick={() => setActiveView('contacts')}><ContactRound size={16} />Add a contact</button></div></section>
              </>
            )}

            {activeView === 'clubs' && (
              <section className="dashboard-section">
                <div className="section-heading"><div><h2>Club directory</h2><p>Browse campus clubs and request membership</p></div><button className="primary-small" type="button" onClick={() => setClubFormOpen((open) => !open)}><Plus size={15} />{clubFormOpen ? 'Close form' : 'Create club'}</button></div>
                {clubFormOpen && <form className="inline-form" onSubmit={handleCreateClub}><Field label="Club name"><input name="name" maxLength={80} required /></Field><Field label="Department"><input name="department" maxLength={80} required placeholder="Computer Science" /></Field><Field label="Description"><input name="description" maxLength={240} required /></Field><button className="primary-small" disabled={isWorking}>Save club</button></form>}
                {data.Clubs.length === 0 ? <EmptyState>No clubs yet. Create one to start the directory.</EmptyState> : <div className="club-list">{data.Clubs.map((club) => {
                  const membership = data.ClubMembers.find((member) => member.clubId === club.id && member.email.toLowerCase() === user.email.toLowerCase());
                  const memberCount = data.ClubMembers.filter((member) => member.clubId === club.id && member.status === 'approved').length + 1;
                  return <article className="club-row" key={club.id}><div className="club-mark">{club.name.slice(0, 1).toUpperCase()}</div><div className="club-info"><h3>{club.name}</h3><p>{club.description}</p><span>{club.department} · {memberCount} members</span></div><div className="row-actions">{club.createdBy.toLowerCase() === user.email.toLowerCase() ? <span className="status-pill">Owner</span> : membership ? <span className="status-pill">{membership.status === 'approved' ? 'Member' : 'Request pending'}</span> : <button className="quiet-action" type="button" disabled={isWorking} onClick={() => joinClub(club)}>Request to join</button>}</div></article>;
                })}</div>}
              </section>
            )}

            {activeView === 'members' && (
              <section className="dashboard-section"><div className="section-heading"><div><h2>Club members</h2><p>Membership requests and approved members</p></div></div>
                {data.ClubMembers.length === 0 ? <EmptyState>No membership requests yet.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Member</th><th>Club</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>{data.ClubMembers.map((member) => {
                  const club = data.Clubs.find((item) => item.id === member.clubId);
                  const canApprove = club?.createdBy.toLowerCase() === user.email.toLowerCase();
                  return <tr key={member.id}><td><strong>{member.name}</strong><small>{member.email}</small></td><td>{clubNames.get(member.clubId) || 'Unknown club'}</td><td>{member.role}</td><td><span className={member.status === 'approved' ? 'status-pill approved' : 'status-pill'}>{member.status}</span></td><td>{canApprove && member.status === 'pending' && <button className="icon-action" title="Approve membership" type="button" onClick={() => updateRecord('ClubMembers', member.id, { status: 'approved' }, 'Membership approved.')}><Check size={16} /></button>}</td></tr>;
                })}</tbody></table></div>}
              </section>
            )}

            {activeView === 'events' && (
              <div className="event-layout"><section className="dashboard-section"><div className="section-heading"><div><h2>Events</h2><p>Browse events and book seats for yourself and guests</p></div></div>
                {data.Events.length === 0 ? <EmptyState>No events have been published yet.</EmptyState> : <div className="event-list">{data.Events.map((event) => {
                  const seats = Number(event.capacity) - bookingCount(event.id);
                  const alreadyBooked = data.Bookings.some((booking) => booking.eventId === event.id && booking.attendeeEmail.toLowerCase() === user.email.toLowerCase());
                  return <article className="event-row" key={event.id}><div className="event-date"><CalendarDays size={18} /><span>{dateLabel(event.startsAt)}</span></div><div className="event-main"><h3>{event.title}</h3><p>{event.description}</p><span>{clubNames.get(event.clubId) || 'Campus event'} · {event.location || 'Location to be announced'}</span></div><div className="event-booking"><strong>{priceLabel(event.price)}</strong><small>{Math.max(0, seats)} seats left</small>{alreadyBooked ? <span className="status-pill approved">Booked</span> : seats > 0 && <form className="booking-form" onSubmit={(formEvent) => bookEvent(event, formEvent)}><label>Guests <input name="guests" type="number" min="0" max="10" defaultValue="0" /></label><button className="primary-small" disabled={isWorking}>Book</button></form>}</div></article>;
                })}</div>}
              </section>
              <section className="dashboard-section"><div className="section-heading"><div><h2>Publish an event</h2><p>Set free entry or a listed ticket price</p></div></div><form className="stack-form" onSubmit={handleCreateEvent}><Field label="Event title"><input name="title" maxLength={100} required /></Field><Field label="Organizing club"><select name="clubId"><option value="">Campus-wide</option>{data.Clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></Field><Field label="Description"><textarea name="description" maxLength={500} rows="3" /></Field><Field label="Location"><input name="location" maxLength={120} required /></Field><Field label="Date and time"><input name="startsAt" type="datetime-local" required /></Field><div className="form-pair"><Field label="Price (0 = free)"><input name="price" type="number" min="0" step="0.01" defaultValue="0" required /></Field><Field label="Capacity"><input name="capacity" type="number" min="1" step="1" defaultValue="50" required /></Field></div><button className="primary-button" disabled={isWorking}>Publish event</button><p className="form-note">Paid event prices are recorded for display; this app does not collect payments.</p></form></section></div>
            )}

            {activeView === 'bookings' && (
              <section className="dashboard-section"><div className="section-heading"><div><h2>My bookings</h2><p>Your event reservations and payment status</p></div></div>{myBookings.length === 0 ? <EmptyState>You have no event bookings yet.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Event</th><th>Booking date</th><th>Guests</th><th>Status</th></tr></thead><tbody>{myBookings.map((booking) => <tr key={booking.id}><td><strong>{eventNames.get(booking.eventId) || 'Event'}</strong></td><td>{dateLabel(booking.bookedAt)}</td><td>{booking.guests}</td><td><span className="status-pill">{booking.paymentStatus}</span></td></tr>)}</tbody></table></div>}</section>
            )}

            {activeView === 'announcements' && (
              <div className="event-layout"><section className="dashboard-section"><div className="section-heading"><div><h2>College feed</h2><p>Announcements appear live for signed-in college members</p></div></div>{data.Announcements.length === 0 ? <EmptyState>No announcements yet.</EmptyState> : <div className="announcement-list">{[...data.Announcements].reverse().map((announcement) => <article className="announcement-row" key={announcement.id}><div className="announcement-icon"><Megaphone size={17} /></div><div><h3>{announcement.title}</h3><p>{announcement.message}</p><span>{announcement.createdBy} · {dateLabel(announcement.createdAt)}</span></div></article>)}</div>}</section>
              <section className="dashboard-section"><div className="section-heading"><div><h2>Post an announcement</h2><p>Visible to users in this college workbook</p></div></div><form className="stack-form" onSubmit={handleCreateAnnouncement}><Field label="Title"><input name="title" maxLength={100} required /></Field><Field label="Announcement"><textarea name="message" maxLength={3000} rows="6" required /></Field><button className="primary-button" disabled={isWorking}>Post to college</button></form></section></div>
            )}

            {activeView === 'participants' && (
              <section className="dashboard-section"><div className="section-heading"><div><h2>Event participants</h2><p>Attendees and guest counts across the workbook</p></div></div>{data.Bookings.length === 0 ? <EmptyState>Participants appear here when people book events.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Participant</th><th>Event</th><th>Guests</th><th>Seats</th><th>Payment</th></tr></thead><tbody>{data.Bookings.map((booking) => <tr key={booking.id}><td><strong>{booking.attendeeName}</strong><small>{booking.attendeeEmail}</small></td><td>{eventNames.get(booking.eventId) || 'Event'}</td><td>{booking.guests}</td><td>{1 + Number(booking.guests || 0)}</td><td>{booking.paymentStatus}</td></tr>)}</tbody></table></div>}</section>
            )}

            {activeView === 'committee' && (
              <div className="event-layout"><section className="dashboard-section"><div className="section-heading"><div><h2>Club organizers</h2><p>Committee members and event organizers</p></div></div>{data.Committee.length === 0 ? <EmptyState>No organizers have been added.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Club</th><th>Role</th></tr></thead><tbody>{data.Committee.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small>{member.email}</small></td><td>{clubNames.get(member.clubId) || 'Club'}</td><td>{member.role}</td></tr>)}</tbody></table></div>}</section>
              <section className="dashboard-section"><div className="section-heading"><div><h2>Add committee member</h2><p>Only a club creator can manage that club’s committee</p></div></div>{data.Clubs.filter((club) => club.createdBy.toLowerCase() === user.email.toLowerCase()).length === 0 ? <EmptyState>Create a club first to add organizers.</EmptyState> : <form className="stack-form" onSubmit={handleAddCommittee}><Field label="Club"><select name="clubId" required>{data.Clubs.filter((club) => club.createdBy.toLowerCase() === user.email.toLowerCase()).map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></Field><Field label="Name"><input name="name" maxLength={80} required /></Field><Field label="College email"><input name="email" type="email" maxLength={254} required /></Field><Field label="Committee role"><select name="role"><option>Event organizer</option><option>Committee member</option><option>Club administrator</option></select></Field><button className="primary-button" disabled={isWorking}>Add organizer</button></form>}</section></div>
            )}

            {activeView === 'contacts' && (
              <div className="event-layout"><section className="dashboard-section"><div className="section-heading"><div><h2>Campus contacts</h2><p>People and offices saved in the workbook</p></div></div>{data.Contacts.length === 0 ? <EmptyState>No contacts saved.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Organization</th><th>Contact</th><th>Role</th><th /></tr></thead><tbody>{data.Contacts.map((contact) => <tr key={contact.id}><td><strong>{contact.name}</strong></td><td>{contact.organization}</td><td>{contact.email}<small>{contact.phone}</small></td><td>{contact.role}</td><td><button className="icon-action danger-action" type="button" title="Remove contact" onClick={() => removeContact(contact.id)}>Remove</button></td></tr>)}</tbody></table></div>}</section>
              <section className="dashboard-section"><div className="section-heading"><div><h2>Add a contact</h2><p>Club, organizer, or campus office</p></div></div><form className="stack-form" onSubmit={handleAddContact}><Field label="Name"><input name="name" maxLength={80} required /></Field><Field label="Email"><input name="email" type="email" maxLength={254} required /></Field><Field label="Phone"><input name="phone" maxLength={32} /></Field><Field label="Organization"><input name="organization" maxLength={100} /></Field><Field label="Role"><input name="role" maxLength={80} /></Field><button className="primary-button" disabled={isWorking}>Save contact</button></form></section></div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}