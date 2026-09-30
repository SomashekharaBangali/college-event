import jwt from 'jsonwebtoken';

export function attachRealtime(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Sign in to receive live updates.'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'campus-connect' });
      return next();
    } catch {
      return next(new Error('Your session expired. Please sign in again.'));
    }
  });

  io.on('connection', (socket) => {
    const domain = socket.user.email.split('@')[1];
    socket.join(`college:${domain}`);
  });
}

export function publishCampusUpdate(io, email, change) {
  const domain = email.split('@')[1];
  io.to(`college:${domain}`).emit('campus:data_changed', change);
}