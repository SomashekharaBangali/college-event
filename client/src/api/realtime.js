import { io } from 'socket.io-client';
import { getSessionToken } from './http.js';

export function connectLiveUpdates() {
  return io({
    auth: { token: getSessionToken() },
    reconnection: true,
    reconnectionDelayMax: 5000,
  });
}