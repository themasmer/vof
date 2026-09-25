const nodemailer = require('nodemailer');
const config = require('config.json');

module.exports = sendEmail;

async function sendEmail({ to, subject, html, from = config.smtpOptions.emailFrom }) {
    const transporter = nodemailer.createTransport(config.smtpOptions);
    if (config.debugMode === true) {
        to = config.defaultEmail;
    }
    await transporter.sendMail({ from, to, subject, html });
}
