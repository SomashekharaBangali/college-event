import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { io as createSocketClient } from 'socket.io-client';

test('authenticates users, stores bookings, and sends live campus updates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'campus-connect-api-'));
  process.env.WORKBOOK_PATH = join(directory, 'Book2.xlsx');
  process.env.JWT_SECRET = 'api-integration-test-secret-at-least-32-chars';
  process.env.ALLOWED_EMAIL_DOMAINS = 'campus.edu';

  const [{ createApp }, { Server }, { attachRealtime }] = await Promise.all([
    import('../app.js'),
    import('socket.io'),
    import('../utils/realtime.js'),
  ]);
  const app = createApp();
  const httpServer = createServer(app);
  const socketServer = new Server(httpServer, { cors: { origin: true } });
  app.locals.io = socketServer;
  attachRealtime(socketServer);
  httpServer.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  const address = httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  let socket;

  try {
    const signupResponse = await fetch(`${origin}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alex Student', email: 'alex@campus.edu', password: 'CampusPass123!' }),
    });
    assert.equal(signupResponse.status, 201);
    const signup = await signupResponse.json();

    const loginResponse = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@campus.edu', password: 'CampusPass123!' }),
    });
    assert.equal(loginResponse.status, 200);
    const session = await loginResponse.json();

    socket = createSocketClient(origin, { auth: { token: session.token }, transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    const liveChange = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket update did not arrive.')), 5000);
      socket.once('campus:data_changed', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    const clubResponse = await fetch(`${origin}/api/data/Clubs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Robotics Club', description: 'Build robots', department: 'CSE' }),
    });
    assert.equal(clubResponse.status, 201);
    const livePayload = await liveChange;
    assert.equal(livePayload.sheet, 'Clubs');

    const club = (await clubResponse.json()).record;
    const eventResponse = await fetch(`${origin}/api/data/Events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Robot Showcase', clubId: club.id, description: 'Club demos', location: 'Main Hall', startsAt: '2026-11-01T10:00', price: 0, capacity: 3 }),
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()).record;

    const bookingResponse = await fetch(`${origin}/api/data/events/${event.id}/book`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guests: 2 }),
    });
    assert.equal(bookingResponse.status, 201);
    assert.equal((await bookingResponse.json()).record.paymentStatus, 'Free');

    const dataResponse = await fetch(`${origin}/api/data`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const data = await dataResponse.json();
    assert.equal(data.Users, undefined);
    assert.equal(data.Bookings[0].attendeeEmail, signup.user.email);
    socket.disconnect();
  } finally {
    socket?.disconnect();
    socketServer.close();
    httpServer.closeAllConnections();
    await rm(directory, { recursive: true, force: true });
  }
});