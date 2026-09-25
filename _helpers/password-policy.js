const commonPasswords = new Set([
    'password', 'password1', 'password123', '123456789012', 'qwertyuiop',
    'letmein123456', 'welcome123456', 'admin123456', 'changeme12345'
]);
const crypto = require('crypto');
const https = require('https');
const config = require('_helpers/config');

function validatePassword(value, helpers) {
    const normalized = String(value || '').toLowerCase();
    if (commonPasswords.has(normalized)) return helpers.error('any.invalid');
    return value;
}

async function assertPasswordPolicy(value) {
    if (String(value).length < 12 || commonPasswords.has(String(value).toLowerCase())) {
        throw 'Password does not meet the security policy';
    }
    if (!config.passwordBreachCheckRequired) return;

    const sha1 = crypto.createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
    let response;
    try {
        response = await rangeQuery(sha1.slice(0, 5));
    } catch (error) {
        throw 'Password security validation is unavailable';
    }
    const suffix = sha1.slice(5);
    if (response.split('\r\n').some(line => line.split(':')[0] === suffix)) {
        throw 'Password does not meet the security policy';
    }
}

function rangeQuery(prefix) {
    return new Promise((resolve, reject) => {
        const request = https.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { 'Add-Padding': 'true', 'User-Agent': 'vofapi-password-policy' },
            timeout: 5000
        }, response => {
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error(`Unexpected breach API status ${response.statusCode}`));
            }
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve(body));
        });
        request.on('timeout', () => request.destroy(new Error('Password breach API timed out')));
        request.on('error', reject);
    });
}

module.exports = { validatePassword, assertPasswordPolicy };
