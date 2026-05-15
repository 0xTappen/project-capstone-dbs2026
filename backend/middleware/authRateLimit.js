const ipBuckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 60;
const LIMITED_AUTH_PATHS = new Set(['/register', '/login', '/change-password']);

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

export default function authRateLimit(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  if (!LIMITED_AUTH_PATHS.has(req.path)) {
    return next();
  }

  const now = Date.now();
  const ip = getClientIp(req);
  const bucket = ipBuckets.get(ip);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    ipBuckets.set(ip, { count: 1, windowStart: now });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return res.status(429).json({
      error: 'Too many authentication requests. Please try again in a few minutes.',
    });
  }

  return next();
}
