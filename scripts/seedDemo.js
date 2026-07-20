require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
//const Product = require('../models/Product');
const Escrow = require('../models/Escrow');
const Jurnal = require('../models/Jurnal');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000
  });
};

const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

const upsertUser = async (selector, payload) => {
  const password = await hashPassword(payload.password);
  return User.findOneAndUpdate(
    selector,
    { $set: { ...payload, password } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI belum diisi di file .env');
  }

  await connectDB();

  const petani = await upsertUser(
    { email: 'petani.demo@agrocelebes.local' },
    {
      nama: 'Petani Demo',
      email: 'petani.demo@agrocelebes.local',
      password: 'DemoAkun123!',
      role: 'petani',
      no_hp: '081234567801',
      alamat: 'Kabupaten Bone, Sulawesi Selatan',
      nama_perusahaan: '',
      koordinat_lokasi: { lat: -4.5454, lng: 120.3021 },
      profil_lahan: { luas_lahan_ha: 2.5, status_lahan: 'belum diverifikasi', cuaca_score: 1.1 },
      isVerified: true
    }
  );

  const kud = await upsertUser(
    { email: 'kud.demo@agrocelebes.local' },
    {
      nama: 'KUD Demo',
      email: 'kud.demo@agrocelebes.local',
      password: 'DemoAkun123!',
      role: 'kud',
      no_hp: '081234567802',
      alamat: 'Kabupaten Soppeng, Sulawesi Selatan',
      nama_perusahaan: 'KUD Agro Sejahtera',
      isVerified: true
    }
  );

  const pabrik = await upsertUser(
    { email: 'pabrik.demo@agrocelebes.local' },
    {
      nama: 'Pabrik Demo',
      email: 'pabrik.demo@agrocelebes.local',
      password: 'DemoAkun123!',
      role: 'pabrik',
      no_hp: '081234567803',
      alamat: 'Makassar, Sulawesi Selatan',
      nama_perusahaan: 'PT Agro Pangan',
      isVerified: true
    }
  );

  const kios = await upsertUser(
    { email: 'kios.demo@agrocelebes.local' },
    {
      nama: 'Kios Demo',
      email: 'kios.demo@agrocelebes.local',
      password: 'DemoAkun123!',
      role: 'kios',
      no_hp: '081234567804',
      alamat: 'Kabupaten Gowa, Sulawesi Selatan',
      nama_perusahaan: 'Kios Pupuk Makmur',
      isVerified: true
    }
  );

  const admin = await upsertUser(
    { email: 'admin.demo@agrocelebes.local' },
    {
      nama: 'Admin Demo',
      email: 'admin.demo@agrocelebes.local',
      password: 'DemoAkun123!',
      role: 'admin',
      no_hp: '081234567805',
      alamat: 'Makassar, Sulawesi Selatan',
      nama_perusahaan: 'AgroCelebes Admin',
      isVerified: true
    }
  );

  // KODE PRODUCT DISINI DIMATIKAN KARENA MODEL BELUM ADA/TIDAK DIPAKAI
  /*
  const product = await Product.findOneAndUpdate(
    ...
  );
  */

  await Jurnal.findOneAndUpdate(
    { petani_id: petani._id, tipe: 'kas', deskripsi: 'Pembelian pupuk demo' },
    {
      $set: {
        petani_id: petani._id,
        tipe: 'kas',
        jenis_kas: 'pengeluaran',
        tanggal: new Date().toISOString().slice(0, 10),
        deskripsi: 'Pembelian pupuk demo',
        nominal: 150000,
        status_selesai: false
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Escrow.findOneAndUpdate(
    { komoditas: 'Gabah Premium Demo', petani_id: petani._id },
    {
      $set: {
        petani_id: petani._id,
        kud_id: kud._id,
        pabrik_id: pabrik._id,
        kios_id: kios._id,
        komoditas: 'Gabah Premium Demo',
        tonase: 15,
        nilai_kontrak: 108000000,
        status: 'pending',
        catatan: 'Data demo untuk alur verifikasi lahan sampai serah pupuk.'
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('Demo data seeded successfully.');
  console.log('Petani:', petani.email);
  console.log('KUD:', kud.email);
  console.log('Pabrik:', pabrik.email);
  console.log('Kios:', kios.email);
  console.log('Admin:', admin.email);
  // console.log('Produk demo:', product.nama_komoditas); // Dimatikan

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Seed demo gagal:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect errors
  }
  process.exit(1);
});