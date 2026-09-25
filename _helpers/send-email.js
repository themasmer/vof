const nodemailer = require('nodemailer');
const config = require('_helpers/config');

module.exports = sendEmail;

async function sendEmail({ to, subject, html, from = config.smtpOptions.emailFrom }) {
    if (!config.smtpOptions.host || !config.smtpOptions.auth || !from) {
        throw new Error('SMTP is not configured');
    }
    const transporter = nodemailer.createTransport(config.smtpOptions);
    if (config.debugMode === true) {
        if (!config.defaultEmail) throw new Error('DEFAULT_EMAIL is required when DEBUG_EMAIL_REDIRECT is enabled');
        to = config.defaultEmail;
    }
    await transporter.sendMail({ from, to, subject, html });
}
