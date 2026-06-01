const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function sameOrigin(req, candidate) {
  try {
    const url = new URL(candidate);
    return url.host === req.get('host');
  } catch {
    return false;
  }
}

function originFromReferer(referer) {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function isAllowedOrigin(req, candidate) {
  if (!candidate) return false;
  if (sameOrigin(req, candidate)) return true;
  return parseAllowedOrigins().includes(candidate);
}

module.exports = function csrfOriginGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const origin = req.get('origin');
  const refererOrigin = originFromReferer(req.get('referer'));

  if (isAllowedOrigin(req, origin) || isAllowedOrigin(req, refererOrigin)) {
    return next();
  }

  return res.status(403).json({ error: 'Invalid request origin' });
};
