# ⚙️ AgroCelebes - Backend (RESTful API)

Ini adalah repositori inti (otak) dari sistem AgroCelebes. Backend ini bertugas mengelola logika bisnis, autentikasi tingkat tinggi, integrasi *Artificial Intelligence*, dan penyimpanan data *Cloud*.

## 🛡️ Keunggulan & Keamanan Arsitektur
- **Keamanan Enterprise (HttpOnly Cookie):** Kami tidak menggunakan *localStorage* untuk menyimpan Token JWT demi mencegah serangan XSS. Token dienkripsi dan disimpan otomatis di *HttpOnly Cookie*.
- **Integrasi LLM AI (Gemini 2.5 Flash):** Sistem merakit *prompt* berlogat lokal, menyimpan memori percakapan, dan menganalisis gambar tanaman (*Vision*) secara asinkron.
- **Anti-Ghost Image Storage:** Menggunakan `Multer` dan API `Cloudinary` untuk mengelola foto. Sistem akan mendeteksi dan menghapus foto dari *cloud* jika produk/user dihapus, menjaga *database* tetap efisien.
- **Proteksi Kuota (Rate Limiting):** API dibekali logika pembatasan hit harian (kuota AI) dan pembatasan percobaan *login/register* untuk mencegah serangan DDoS atau *Spam Bot*.

## 🛠️ Teknologi yang Digunakan
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas + Mongoose ORM
- **Security:** JSON Web Token (JWT), bcrypt.js, Cookie-Parser, CORS.
- **Cloud Storage:** Cloudinary
- **AI Integrasi:** `@google/generative-ai`

## ⚙️ Cara Menjalankan Server Lokal

1. **Clone repositori ini:**
   ```bash
   git clone [https://github.com/aksaex/agrocelebes-backend.git](https://github.com/aksaex/agrocelebes-backend.git)
   cd agrocelebes-backend
