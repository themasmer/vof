const crypto = require('crypto');
const config = require('_helpers/config');

const CSRF_COOKIE = config.cookieSecure ? '__Host-csrf' : 'csrfToken';

function createCsrfToken(sessionHash) {
    const nonce = crypto.randomBytes(32).toString('base64url');
    const signature = sign(sessionHash, nonce);
    return `${nonce}.${signature}`;
}

function setCsrfCookie(res, sessionHash) {
    res.cookie(CSRF_COOKIE, createCsrfToken(sessionHash), {
        httpOnly: false,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        path: '/'
    });
}

function clearCsrfCookie(res) {
    res.clearCookie(CSRF_COOKIE, { secure: config.cookieSecure, sameSite: config.cookieSameSite, path: '/' });
}

function validateCsrf(req, sessionHash) {
    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    if (origin && !config.allowedOrigins.includes(origin)) return false;
    if (fetchSite === 'cross-site') return false;
    const cookieToken = req.cookies[CSRF_COOKIE];
    const headerToken = req.get('x-csrf-token');
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) return false;

    const [nonce, signature, extra] = cookieToken.split('.');
    if (!nonce || !signature || extra) return false;
    return safeEqual(signature, sign(sessionHash, nonce));
}

function requireCsrf(req, res, next) {
    if (!req.auth?.sessionHash || !validateCsrf(req, req.auth.sessionHash)) {
        return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next();
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    if ((origin && !config.allowedOrigins.includes(origin)) || fetchSite === 'cross-site') {
        return res.status(403).json({ message: 'Cross-origin request rejected' });
    }
    next();
}

function sign(sessionHash, nonce) {
    return crypto.createHmac('sha256', config.csrfSecret).update(`${sessionHash}.${nonce}`).digest('base64url');
}

function safeEqual(a, b) {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

module.exports = { CSRF_COOKIE, setCsrfCookie, clearCsrfCookie, validateCsrf, requireCsrf, requireTrustedOrigin };
