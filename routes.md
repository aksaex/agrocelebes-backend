# AgroCelebes API Routes

Dokumentasi ringkas endpoint utama backend AgroCelebes.

## Auth
- `POST /api/auth/register` - registrasi user publik dengan role `petani`, `kud`, `pabrik`, atau `kios`
- `POST /api/auth/login` - login dan set token JWT ke HttpOnly cookie
- `GET /api/auth/me` - membaca sesi aktif dari cookie
- `PUT /api/auth/profile` - update profil user login
- `POST /api/auth/logout` - hapus cookie token
- `POST /api/auth/forgot-password` - kirim tautan reset sandi
- `PUT /api/auth/reset-password/:token` - set ulang sandi

## Products
- `GET /api/products` - daftar produk
- `GET /api/products/latest` - produk terbaru
- `GET /api/products/:id` - detail produk
- `POST /api/products` - tambah produk petani
- `PUT /api/products/:id` - edit produk
- `DELETE /api/products/:id` - hapus produk

## Escrow
- `GET /api/escrow` - daftar transaksi escrow per role
- `GET /api/escrow/agregasi/tonase` - total tonase per komoditas
- `POST /api/escrow` - buat transaksi escrow baru
- `PUT /api/escrow/:id/verify-land` - verifikasi lahan oleh KUD
- `PUT /api/escrow/:id/pay-dp` - simulasi bayar DP oleh pabrik
- `PUT /api/escrow/:id/deliver-fertilizer` - serah pupuk oleh kios
- `PUT /api/escrow/:id/complete` - tutup kontrak menjadi `selesai`

## Jurnal
- `GET /api/jurnal` - ambil jurnal petani
- `POST /api/jurnal` - tambah jurnal kas/jadwal
- `PUT /api/jurnal/:id` - update jurnal
- `DELETE /api/jurnal/:id` - hapus jurnal

## Chat
- `POST /api/chat` - chat AI penyuluh dengan memory percakapan
- `GET /api/chat/history` - riwayat chat pengguna

## Weather
- `GET /api/weather?adm4=...` - data prakiraan cuaca BMKG

## Admin
- `GET /api/admin/users` - daftar user untuk admin
- `GET /api/admin/stats` - statistik ringkas

## Catatan Keamanan
- Endpoint sensitif memakai `verifikasiToken`
- Akses peran dibatasi dengan `authorizeRoles`
- Token login disimpan di HttpOnly cookie, bukan localStorage