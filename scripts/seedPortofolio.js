/**
 * =====================================================================
 * SEEDER PORTOFOLIO PETANI
 * Mengisi rekam jejak (lama_berusaha_tani), riwayat_panen, dan
 * catatan_keuangan untuk SEMUA user dengan role 'petani'.
 *
 * Jalankan: node scripts/seedPortofolio.js
 *           (atau: npm run seed:portofolio)
 *
 * Catatan: angka dihasilkan acak namun dalam rentang yang masuk akal
 * untuk padi/gabah di Sulawesi Selatan, dan bersifat IDEMPOTENT
 * (field di-$set, jadi aman dijalankan berulang kali).
 * =====================================================================
 */
require('dotenv').config({ path: __dirname + '/../.env' }); // Mengarahkan ke root backend
const mongoose = require('mongoose');

const User = require('../models/User'); // Pastikan path ini sesuai

// ---------------------------------------------------------------------
// REFERENSI HARGA RIIL (Sulawesi Selatan)
// ---------------------------------------------------------------------
const HARGA_GABAH_PER_TON = 7200000;        // konsisten dengan routes/escrow.js
const PRODUKSI_TON_PER_HA = 5;              // produktivitas rata-rata sawah
const BIAYA_SAPROTAN_PER_HA = 6500000;      // pupuk, benih, olah tanah
const PREMI_AUTP_PETANI_PER_HA = 36000;     // AUTP Jasindo: 20% x Rp180.000/Ha

// ---------------------------------------------------------------------
// HELPER ACAK
// ---------------------------------------------------------------------
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, desimal = 1) => Number((Math.random() * (max - min) + min).toFixed(desimal));
const pilih = (daftar) => daftar[randInt(0, daftar.length - 1)];
const bulatkanRibuan = (nilai) => Math.round(nilai / 1000) * 1000;
const hariLalu = (jumlahHari) => new Date(Date.now() - jumlahHari * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------
// GENERATOR DATA PER PETANI
// ---------------------------------------------------------------------
const buatRiwayatPanen = (luasHa, tahunSekarang) => {
  // 2 musim: musim tanam sebelumnya + musim terakhir yang baru dipanen
  const daftarMusim = [
    `${tahunSekarang - 1}/${tahunSekarang} - Musim Rendengan`,
    `${tahunSekarang} - Musim Gadu`
  ];

  return daftarMusim.map((namaMusim, indeks) => ({
    musim: namaMusim,
    // volume naik-turun wajar di sekitar produktivitas normal (5 ton/Ha)
    volume_ton: randFloat(luasHa * PRODUKSI_TON_PER_HA * 0.82, luasHa * PRODUKSI_TON_PER_HA * 1.12, 1),
    kualitas: indeks === 0 ? pilih(['Premium', 'Medium', 'Standar']) : pilih(['Premium', 'Premium', 'Medium'])
  }));
};

const buatCatatanKeuangan = (luasHa) => {
  const biayaSaprotan = bulatkanRibuan(luasHa * BIAYA_SAPROTAN_PER_HA * randFloat(0.75, 1.0, 2));
  const kreditKud = bulatkanRibuan(luasHa * 3000000 * randFloat(0.6, 1.1, 2));
  const pendapatanPanen = bulatkanRibuan(luasHa * PRODUKSI_TON_PER_HA * HARGA_GABAH_PER_TON * randFloat(0.85, 1.05, 2));
  const premiAutp = bulatkanRibuan(Math.max(PREMI_AUTP_PETANI_PER_HA, luasHa * PREMI_AUTP_PETANI_PER_HA));

  return [
    {
      // Belanja saprotan: umumnya sudah dibayar tunai/lunas ke kios mitra
      tanggal: hariLalu(randInt(25, 45)),
      jenis_transaksi: 'Pembelian Saprotan (Pupuk & Benih)',
      nominal: biayaSaprotan,
      status_lunas: true
    },
    {
      // Kredit modal tanam dari KUD: sebagian sudah lunas, sebagian masih berjalan
      tanggal: hariLalu(randInt(10, 24)),
      jenis_transaksi: pilih([
        'Kredit Saprotan KUD',
        'Angsuran Pinjaman Modal Tanam',
        'Pinjaman Modal Tanam (Escrow)'
      ]),
      nominal: kreditKud,
      status_lunas: Math.random() < 0.6
    },
    {
      // Bukti penjualan hasil panen lewat escrow (transparansi arus kas masuk)
      tanggal: hariLalu(randInt(1, 9)),
      jenis_transaksi: pilih([
        'Penerimaan Hasil Panen (Escrow BPD)',
        'Pelunasan Gabah ke Pabrik',
        'Pencairan Escrow Hasil Panen'
      ]),
      nominal: pendapatanPanen,
      status_lunas: true
    },
    {
      // Premi asuransi: menunjukkan petani terlindungi risiko gagal panen
      tanggal: hariLalu(randInt(3, 12)),
      jenis_transaksi: 'Premi AUTP Jasindo (Proteksi Gagal Panen)',
      nominal: premiAutp,
      status_lunas: true
    }
  ];
};

// ---------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------
const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI belum diisi di file .env');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000
  });
  console.log('✅ Terhubung ke MongoDB.');

  const paraPetani = await User.find({ role: 'petani' }).select('nama email profil_lahan');

  if (paraPetani.length === 0) {
    console.warn('⚠️  Tidak ada user dengan role "petani". Jalankan dulu: npm run seed:demo');
    await mongoose.disconnect();
    return;
  }

  const tahunSekarang = new Date().getFullYear();
  let berhasil = 0;

  for (const petani of paraPetani) {
    // Luas lahan dipakai sebagai basis hitungan agar angka konsisten dengan profilnya
    const luasHa = Number(petani.profil_lahan?.luas_lahan_ha) || 2;

    const riwayatPanen = buatRiwayatPanen(luasHa, tahunSekarang);
    const catatanKeuangan = buatCatatanKeuangan(luasHa);
    const lamaBertani = randInt(5, 15);

    await User.updateOne(
      { _id: petani._id },
      {
        $set: {
          lama_berusaha_tani: lamaBertani,
          riwayat_panen: riwayatPanen,
          catatan_keuangan: catatanKeuangan
        }
      }
    );

    berhasil += 1;
    const totalVolume = riwayatPanen.reduce((total, item) => total + item.volume_ton, 0);
    const piutang = catatanKeuangan
      .filter((item) => !item.status_lunas)
      .reduce((total, item) => total + item.nominal, 0);

    console.log(
      `  • ${petani.nama} (${petani.email}) | ${luasHa} Ha | ${lamaBertani} th | ` +
      `${totalVolume.toFixed(1)} ton | piutang Rp ${piutang.toLocaleString('id-ID')}`
    );
  }

  console.log(`\n📦 Seeding portofolio selesai: ${berhasil}/${paraPetani.length} petani terisi.`);
  console.log('Buka Dashboard KUD > tab Kontrak > "Lihat Portofolio Risiko" untuk memverifikasi.');

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('❌ Seeding portofolio gagal:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // abaikan error disconnect
  }
  process.exit(1);
});