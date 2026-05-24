const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const { verifikasiToken } = require('../middleware/authMiddleware');
const Chat = require('../models/Chat'); // Import model
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/', verifikasiToken, upload.single('image'), async (req, res) => {
  try {
    const { pesan } = req.body;
    const userId = req.user.id;
    const LIMIT_HARIAN = 10; // Batasi 10 chat per hari

    // 1. Cek / Inisialisasi Data Chat di DB
    let dataChat = await Chat.findOne({ userId });
    if (!dataChat) {
      dataChat = new Chat({ userId, percakapan: [] });
    }

    // Solusi agar tidak crash jika data lama tidak punya kuota
    if (!dataChat.kuotaHarian || !dataChat.kuotaHarian.terakhirChat) {
      dataChat.kuotaHarian = { jumlah: 0, terakhirChat: new Date() };
    }

    // 2. Logika Reset Kuota Harian
    const hariIni = new Date().toDateString();
    const terakhirChat = new Date(dataChat.kuotaHarian.terakhirChat).toDateString();

    if (hariIni !== terakhirChat) {
      dataChat.kuotaHarian.jumlah = 0;
      dataChat.kuotaHarian.terakhirChat = new Date();
    }

    // 3. Cek apakah kuota habis
    if (dataChat.kuotaHarian.jumlah >= LIMIT_HARIAN) {
      return res.status(429).json({ 
        pesan: 'Kuota harian Anda habis.', 
        balasan: 'Tabe\', kuota tanya jawab gratis Anda hari ini sudah habis. Silakan coba lagi besok di\'!' 
      });
    }

    // 4. Ambil 5 pesan terakhir untuk "Memori" AI agar nyambung
    const konteksLama = dataChat.percakapan.slice(-5).map(c => 
      `${c.role === 'user' ? 'Petani' : 'Penyuluh'}: ${c.text}`
    ).join('\n');

    const prompt = `
      Kamu adalah "Penyuluh Pintar" AgroCelebes. Fokus: Kakao, Kopi, Jagung, Cengkeh di Sulsel.
      Gunakan logat lokal (iye', tabe', ki', dll).
      
      KONTEKS CHAT SEBELUMNYA:
      ${konteksLama}

      PERTANYAAN BARU: "${pesan}"
    `;

    // 👇 KEMBALI MENGGUNAKAN MODEL ANDA YANG TERBUKTI JALAN
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let result;
    if (req.file) {
      // Format array untuk gambar + teks (format asli Anda)
      const imageParts = [{ inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype } }];
      result = await model.generateContent([prompt, ...imageParts]);
    } else {
      result = await model.generateContent(prompt);
    }

    const aiResponse = result.response.text();

    // 5. Simpan ke Database & Update Kuota
    dataChat.percakapan.push({ role: 'user', text: pesan || "[Gambar Dikirim]" });
    dataChat.percakapan.push({ role: 'bot', text: aiResponse });
    dataChat.kuotaHarian.jumlah += 1;
    await dataChat.save();

    res.json({ 
      balasan: aiResponse, 
      sisaKuota: LIMIT_HARIAN - dataChat.kuotaHarian.jumlah 
    });

  } catch (error) {
    console.error('Error Gemini AI:', error);
    res.status(500).json({ pesan: 'Gangguan teknis.', error: error.message });
  }
});

// Endpoint untuk mengambil riwayat saat pertama kali load
router.get('/history', verifikasiToken, async (req, res) => {
  try {
    const dataChat = await Chat.findOne({ userId: req.user.id });
    res.json(dataChat ? dataChat.percakapan : []);
  } catch (error) {
    console.error('Error Get History:', error);
    res.status(500).json({ pesan: 'Gagal ambil riwayat.' });
  }
});

module.exports = router;