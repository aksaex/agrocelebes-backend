const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const verifikasiToken = require('../middleware/authMiddleware');

const router = express.Router();

// Gunakan penyimpanan memory (RAM) sementara agar file bisa langsung dikirim ke Gemini tanpa disimpan ke harddisk
const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST: Endpoint untuk bertanya ke Penyuluh Pintar (Mendukung Gambar/Multimodal)
router.post('/', verifikasiToken, upload.single('image'), async (req, res) => {
  try {
    const { pesan } = req.body;

    if (!pesan && !req.file) {
      return res.status(400).json({ pesan: 'Pesan atau gambar tidak boleh kosong!' });
    }

    // Gemini 1.5 Flash sangat cepat dan mendukung analisis gambar
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Kamu adalah "Penyuluh Pintar", asisten virtual pertanian dari aplikasi AgroCelebes.
      Tugasmu adalah membantu petani di Sulawesi Selatan dan sekitarnya.
      Fokus keahlianmu adalah komoditas lokal seperti kakao, kopi toraja, jagung, dan cengkeh.
      
      INSTRUKSI BAHASA:
      1. Kamu harus bisa memahami jika petani bertanya menggunakan Bahasa Bugis, Bahasa Makassar, atau logat lokal Sulawesi Selatan.
      2. Jawablah menggunakan campuran Bahasa Indonesia yang santai, namun selipkan kosakata/logat khas Sulawesi Selatan (seperti "tabe'", "iye'", "ki'", "di'", "mi", "pale").
      3. Jika petani menyapamu dengan Bahasa Bugis murni (misalnya "Aga kareba?"), balaslah dengan sapaan Bugis yang sopan juga sebelum menjawab inti pertanyaannya.
      4. Tetap berikan solusi pertanian yang akurat, praktis, dan tidak bertele-tele.
      
      Pertanyaan Petani: "${pesan}"
    `;

    let result;

    if (req.file) {
      // Jika petani mengirim gambar, rakit format khusus untuk Gemini Vision
      const imageParts = [
        {
          inlineData: {
            data: req.file.buffer.toString("base64"), // Ubah gambar jadi teks base64
            mimeType: req.file.mimetype
          }
        }
      ];
      // Kirim Prompt + Gambar
      result = await model.generateContent([prompt, ...imageParts]);
    } else {
      // Jika hanya teks biasa
      result = await model.generateContent(prompt);
    }

    const aiResponse = result.response.text();
    res.json({ balasan: aiResponse });

  } catch (error) {
    console.error('Error Gemini AI:', error);
    res.status(500).json({ pesan: 'Penyuluh Pintar sedang sibuk, coba beberapa saat lagi.', error: error.message });
  }
});

module.exports = router;