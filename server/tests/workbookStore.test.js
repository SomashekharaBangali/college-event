import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import ExcelJS from 'exceljs';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'campus-connect-server-'));
process.env.WORKBOOK_PATH = join(temporaryDirectory, 'Book2.xlsx');
const store = await import('../utils/workbookStore.js');
after(() => rm(temporaryDirectory, { recursive: true, force: true }));

test('writes campus records to one workbook and reads them back', async () => {
  await store.initializeWorkbook();
  const club = await store.createRecord('Clubs', {
    name: 'Robotics Club', description: 'Build robots', department: 'CSE', createdBy: 'owner@campus.edu',
  });
  const event = await store.createRecord('Events', {
    title: 'Robot Showcase', clubId: club.id, location: 'Main Hall', startsAt: '2026-11-01T10:00', price: 0, capacity: 80,
  });
  const booking = await store.createRecord('Bookings', {
    eventId: event.id, attendeeName: 'Sam Student', attendeeEmail: 'sam@campus.edu', guests: 2, paymentStatus: 'Free',
  });
  await store.updateRecord('ClubMembers', 'missing', { status: 'approved' });
  const data = await store.getWorkbookData();

  assert.equal(data.Clubs[0].name, 'Robotics Club');
  assert.equal(data.Events[0].title, 'Robot Showcase');
  assert.equal(data.Bookings[0].id, booking.id);
  assert.equal(data.Bookings[0].guests, 2);
  assert.ok(await store.findUserByEmail('missing@campus.edu') === null);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(store.getWorkbookPath());
  assert.equal(workbook.getWorksheet('Events').getRow(2).getCell(2).value, 'Robot Showcase');
});