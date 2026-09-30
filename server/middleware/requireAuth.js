import jwt from 'jsonwebtoken';

export function requireAuth(request, response, next) {
  const authorization = request.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return response.status(401).json({ message: 'Sign in to continue.' });

  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'campus-connect' });
    return next();
  } catch {
    return response.status(401).json({ message: 'Your session expired. Please sign in again.' });
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    return response.status(403).json({ message: 'Administrator access is required.' });
  }
  return next();
}