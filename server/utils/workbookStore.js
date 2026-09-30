import { randomUUID } from 'node:crypto';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const serverDirectory = fileURLToPath(new URL('..', import.meta.url));
const workbookPath = resolve(serverDirectory, process.env.WORKBOOK_PATH || '../Book2.xlsx');
const schemas = {
  Users: ['id', 'name', 'email', 'passwordHash', 'isVerified', 'createdAt', 'role'],
  Clubs: ['id', 'name', 'description', 'department', 'createdBy', 'createdAt'],
  ClubMembers: ['id', 'clubId', 'name', 'email', 'role', 'status', 'joinedAt'],
  Committee: ['id', 'clubId', 'name', 'email', 'role', 'createdAt'],
  Events: ['id', 'title', 'clubId', 'description', 'location', 'startsAt', 'price', 'capacity', 'createdBy', 'createdAt'],
  Bookings: ['id', 'eventId', 'attendeeName', 'attendeeEmail', 'guests', 'paymentStatus', 'bookedAt'],
  Contacts: ['id', 'name', 'email', 'phone', 'organization', 'role', 'createdBy', 'createdAt'],
  Announcements: ['id', 'title', 'message', 'audience', 'createdBy', 'createdAt'],
};
export const workbookSheets = Object.keys(schemas);

let operationQueue = Promise.resolve();

function getSheet(workbook, name) {
  const columns = schemas[name];
  if (!columns) throw new Error('Unknown workbook sheet.');

  const sheet = workbook.getWorksheet(name) ?? workbook.addWorksheet(name);
  const currentColumns = sheet.getRow(1).values.slice(1);
  if (currentColumns.length === 0) {
    sheet.getRow(1).values = columns;
  } else if (name === 'Users' && currentColumns.join('|') === 'id|name|email|passwordHash|isVerified|createdAt') {
    sheet.getRow(1).getCell(columns.length).value = 'role';
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      if (!sheet.getRow(rowIndex).getCell(columns.length).value) {
        sheet.getRow(rowIndex).getCell(columns.length).value = 'student';
      }
    }
  } else if (currentColumns.length !== columns.length || currentColumns.some((column, index) => column !== columns[index])) {
    throw new Error(`The ${name} sheet has unexpected columns.`);
  }
  return sheet;
}

async function loadWorkbook() {
  const workbook = new ExcelJS.Workbook();
  try {
    await access(workbookPath);
    await workbook.xlsx.readFile(workbookPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const name of Object.keys(schemas)) getSheet(workbook, name);
  return workbook;
}

async function persistWorkbook(workbook) {
  await mkdir(dirname(workbookPath), { recursive: true });
  const temporaryPath = `${workbookPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await workbook.xlsx.writeFile(temporaryPath);
    await rename(temporaryPath, workbookPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'EACCES') {
      throw new Error('Cannot save Book2.xlsx. Close it in Excel and retry.');
    }
    throw error;
  }
}

function rowToRecord(sheet, rowIndex, name) {
  const columns = schemas[name];
  const row = sheet.getRow(rowIndex);
  return Object.fromEntries(columns.map((column, index) => [column, row.getCell(index + 1).value]));
}

function listRecords(sheet, name) {
  const records = [];
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const record = rowToRecord(sheet, rowIndex, name);
    if (record.id) records.push(record);
  }
  return records;
}

function runOperation(operation, write = false) {
  const result = operationQueue.then(async () => {
    const workbook = await loadWorkbook();
    const value = await operation(workbook);
    if (write) await persistWorkbook(workbook);
    return value;
  });
  operationQueue = result.catch(() => undefined);
  return result;
}

export async function initializeWorkbook() {
  return runOperation(() => undefined, true);
}

export function getWorkbookData() {
  return runOperation((workbook) => Object.fromEntries(Object.keys(schemas).map((name) => [
    name,
    listRecords(getSheet(workbook, name), name),
  ])));
}

export function findUserByEmail(email) {
  return runOperation((workbook) => {
    const sheet = getSheet(workbook, 'Users');
    return listRecords(sheet, 'Users').find((user) => String(user.email).toLowerCase() === email) ?? null;
  });
}

export function createUser(user) {
  return runOperation((workbook) => {
    const sheet = getSheet(workbook, 'Users');
    const existingUser = listRecords(sheet, 'Users').find((row) => String(row.email).toLowerCase() === user.email);
    if (existingUser) return null;
    const record = {
      id: randomUUID(),
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      isVerified: false,
      createdAt: new Date(),
      role: 'student',
    };
    sheet.addRow(schemas.Users.map((column) => record[column]));
    return record;
  }, true);
}

function findRecordRow(sheet, name, id) {
  return Array.from({ length: Math.max(0, sheet.rowCount - 1) }, (_, index) => index + 2)
    .find((rowIndex) => String(sheet.getRow(rowIndex).getCell(1).value) === id);
}

export function createRecord(name, values) {
  return runOperation((workbook) => {
    const sheet = getSheet(workbook, name);
    const columns = schemas[name];
    const record = {
      ...values,
      id: randomUUID(),
      createdAt: new Date(),
      joinedAt: new Date(),
      bookedAt: new Date(),
    };
    sheet.addRow(columns.map((column) => record[column] ?? null));
    return record;
  }, true);
}

export function createBooking(values) {
  return runOperation((workbook) => {
    const events = listRecords(getSheet(workbook, 'Events'), 'Events');
    const event = events.find((record) => record.id === values.eventId);
    if (!event) return { status: 'missing' };

    const bookingsSheet = getSheet(workbook, 'Bookings');
    const bookings = listRecords(bookingsSheet, 'Bookings').filter((record) => record.eventId === event.id);
    if (bookings.some((record) => record.attendeeEmail === values.attendeeEmail)) return { status: 'duplicate' };
    const seatsTaken = bookings.reduce((total, record) => total + 1 + Number(record.guests || 0), 0);
    if (seatsTaken + 1 + values.guests > Number(event.capacity)) return { status: 'full' };

    const record = {
      ...values,
      id: randomUUID(),
      bookedAt: new Date(),
    };
    bookingsSheet.addRow(schemas.Bookings.map((column) => record[column] ?? null));
    return { status: 'created', record, event };
  }, true);
}

export function updateRecord(name, id, updates) {
  return runOperation((workbook) => {
    const sheet = getSheet(workbook, name);
    const columns = schemas[name];
    const rowIndex = findRecordRow(sheet, name, id);
    if (!rowIndex) return null;
    const record = rowToRecord(sheet, rowIndex, name);
    for (const [key, value] of Object.entries(updates)) {
      if (columns.includes(key) && !['id', 'createdAt'].includes(key)) record[key] = value;
    }
    columns.forEach((column, index) => {
      sheet.getRow(rowIndex).getCell(index + 1).value = record[column] ?? null;
    });
    return record;
  }, true);
}

export function deleteRecord(name, id) {
  return runOperation((workbook) => {
    const sheet = getSheet(workbook, name);
    const rowIndex = findRecordRow(sheet, name, id);
    if (!rowIndex) return false;
    sheet.spliceRows(rowIndex, 1);
    return true;
  }, true);
}

export function getWorkbookPath() {
  return workbookPath;
}