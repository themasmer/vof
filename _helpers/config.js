const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} must be configured`);
    return value;
}

function positiveInteger(name, fallback) {
    const value = Number(process.env[name] || fallback);
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
    return value;
}

function boolean(name, fallback) {
    const value = process.env[name];
    if (value === undefined) return fallback;
    return value === 'true';
}

function baseUrl(value, name) {
    const url = new URL(value);
    if (isProduction && url.protocol !== 'https:') throw new Error(`${name} must use https in production`);
    return url.origin;
}

const developmentSecret = crypto.randomBytes(48).toString('base64url');
const jwtSecret = process.env.JWT_SECRET || (isProduction ? required('JWT_SECRET') : developmentSecret);
const csrfSecret = process.env.CSRF_SECRET || (isProduction ? required('CSRF_SECRET') : crypto.randomBytes(48).toString('base64url'));
const jitsiSecret = process.env.JITSI_JWT_SECRET || (isProduction ? required('JITSI_JWT_SECRET') : crypto.randomBytes(48).toString('base64url'));
if (jwtSecret.length < 32 || csrfSecret.length < 32 || jitsiSecret.length < 32) {
    throw new Error('JWT_SECRET, CSRF_SECRET, and JITSI_JWT_SECRET must each be at least 32 characters');
}
const clientUrl = baseUrl(process.env.CLIENT_URL || 'http://localhost:3000', 'CLIENT_URL');
const allowedOrigins = (process.env.CORS_ORIGINS || clientUrl)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
    .map(origin => baseUrl(origin, 'CORS_ORIGINS'));
const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
const cookieSecure = boolean('COOKIE_SECURE', isProduction);

if (isProduction) {
    [
        'CLIENT_URL', 'CORS_ORIGINS', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE',
        'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'
    ].forEach(required);
}

if (!['lax', 'strict', 'none'].includes(sameSite)) throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
if (isProduction && !cookieSecure) throw new Error('COOKIE_SECURE must be true in production');
if (sameSite === 'none' && !cookieSecure) {
    throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
}

module.exports = {
    isProduction,
    clientUrl,
    allowedOrigins,
    jwtSecret,
    csrfSecret,
    jitsiSecret,
    jwtIssuer: process.env.JWT_ISSUER || 'vofapi',
    jwtAudience: process.env.JWT_AUDIENCE || 'vofapi-clients',
    cookieSecure,
    cookieSameSite: sameSite,
    trustProxy: boolean('TRUST_PROXY', false),
    company: process.env.COMPANY_NAME || 'VOF',
    debugMode: boolean('DEBUG_EMAIL_REDIRECT', false),
    defaultEmail: process.env.DEFAULT_EMAIL,
    database: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: positiveInteger('DB_PORT', 3306),
        user: process.env.DB_USER || 'vofapi',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'vofapi'
    },
    smtpOptions: {
        host: process.env.SMTP_HOST,
        port: positiveInteger('SMTP_PORT', 587),
        secure: boolean('SMTP_SECURE', false),
        auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        } : undefined,
        emailFrom: process.env.SMTP_FROM
    },
    otp: {
        allowedAttempts: positiveInteger('OTP_ALLOWED_ATTEMPTS', 5),
        validMinutes: positiveInteger('OTP_VALID_MINUTES', 15)
    },
    passwordReset: {
        validMinutes: positiveInteger('PASSWORD_RESET_VALID_MINUTES', 60)
    },
    verification: {
        validMinutes: positiveInteger('VERIFICATION_VALID_MINUTES', 1440)
    },
    session: {
        validMinutes: positiveInteger('SESSION_VALID_MINUTES', 15),
        refreshToken: positiveInteger('REFRESH_TOKEN_VALID_MINUTES', 480)
    },
    loginRateLimit: {
        windowMs: positiveInteger('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        max: positiveInteger('LOGIN_RATE_LIMIT_MAX', 10)
    },
    passwordBreachCheckRequired: boolean('PASSWORD_BREACH_CHECK_REQUIRED', isProduction)
};
