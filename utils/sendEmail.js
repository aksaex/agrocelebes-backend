const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Kita gunakan SMTP Gmail sebagai pengirim
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Email developer (Gmail Anda)
      pass: process.env.EMAIL_PASS  // App Password dari Gmail
    }
  });

  const mailOptions = {
    from: 'AgroCelebes Support <no-reply@agrocelebes.com>',
    to: options.email,
    subject: options.subject,
    html: options.message, // Kita pakai format HTML agar tampilan email rapi
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;