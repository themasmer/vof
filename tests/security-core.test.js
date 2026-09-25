const test = require('node:test');
const assert = require('node:assert/strict');

require('rootpath')();
const config = require('_helpers/config');
const { setCsrfCookie, validateCsrf } = require('_middleware/csrf');
const { validatePassword } = require('_helpers/password-policy');

test('signed CSRF token validates only for its bound session and trusted origin', () => {
    const cookies = {};
    const response = { cookie: (name, value) => { cookies[name] = value; } };
    setCsrfCookie(response, 'session-a');
    const token = Object.values(cookies)[0];
    const request = {
        cookies,
        get: name => ({ 'x-csrf-token': token, origin: config.allowedOrigins[0], 'sec-fetch-site': 'same-origin' })[name.toLowerCase()]
    };
    assert.equal(validateCsrf(request, 'session-a'), true);
    assert.equal(validateCsrf(request, 'session-b'), false);
    request.get = name => ({ 'x-csrf-token': token, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' })[name.toLowerCase()];
    assert.equal(validateCsrf(request, 'session-a'), false);
});

test('password policy rejects a known weak password', () => {
    const errors = [];
    const result = validatePassword('password123', { error: code => { errors.push(code); return code; } });
    assert.equal(result, 'any.invalid');
    assert.deepEqual(errors, ['any.invalid']);
});
