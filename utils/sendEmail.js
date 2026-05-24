const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 👇 DETEKSI DINI: Cek apakah env terbaca oleh Vercel
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error("🔴 ERROR: EMAIL_USER atau EMAIL_PASS kosong/tidak terbaca di .env!");
        throw new Error("Konfigurasi email server belum diatur (ENV kosong).");
    }

    // Gunakan Host & Port eksplisit agar Vercel tidak diblokir
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // true untuk port 465
        auth: {
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS  
        },
        tls: {
            rejectUnauthorized: false 
        }
    });

    const mailOptions = {
        from: `"AgroCelebes" <${process.env.EMAIL_USER}>`, 
        to: options.email,
        subject: options.subject,
        html: options.message
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;