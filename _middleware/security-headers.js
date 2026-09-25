const config = require('_helpers/config');

module.exports = function securityHeaders(req, res, next) {
    res.set({
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
        'Cross-Origin-Resource-Policy': 'same-site'
    });
    if (config.isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
};
