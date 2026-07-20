# AgroCelebes Validation Report

Ringkasan validasi teknis yang sudah dijalankan di workspace.

## Hasil Test
- `npm test` backend: lulus 14 skenario
- Cakupan test:
  - autentikasi token
  - RBAC role check
  - normalisasi role
  - validasi daftar role
  - perhitungan AgroScore

## Build
- Frontend Vite build: lulus
- PWA service worker: ter-generate

## Demo Data
- Seeder demo berhasil dijalankan ke MongoDB Atlas
- Akun demo tersedia untuk:
  - admin
  - petani
  - KUD
  - pabrik
  - kios

## Fitur yang Tervalidasi
- Login dengan HttpOnly cookie
- Bootstrap sesi dari `/api/auth/me`
- Dashboard petani dengan geotagging dan penyimpanan lokal
- Dashboard KUD dengan peta Leaflet mockup NDVI
- Dashboard kios dengan invoice guarantee

## Catatan
- Lighthouse, UAT internal, dan SUS belum dijalankan di workspace ini
- Untuk laporan final, data tersebut perlu diisi dari pengujian manual/alat eksternal