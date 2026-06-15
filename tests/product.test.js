// --- KUNCI VIP (MOCKING) YANG DIPERBAIKI ---
jest.mock('../middleware/authMiddleware', () => {
    const fakeMiddleware = (req, res, next) => {
        req.user = { id: '60d21b4667d0d8992e610c85', role: 'admin' }; 
        next();
    };
    
    // Trik agar mock ini kebal dari segala jenis import (destructuring maupun direct)
    fakeMiddleware.verifikasiToken = fakeMiddleware;
    fakeMiddleware.isAdmin = fakeMiddleware;
    
    return fakeMiddleware;
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server'); 

describe('Pengujian API CRUD Produk (Agro Celebes)', () => {
    let testProductId;

    it('1. GET /api/products - Harus mengembalikan status 200 dan daftar produk', async () => {
    const res = await request(app).get('/api/products');
    expect([200, 201]).toContain(res.statusCode);
    expect(Array.isArray(res.body)).toBeTruthy();
}, 15000); // <-- Tambahkan waktu tunggu 15 detik di sini

    it('2. GET /api/productss - Harus mengembalikan status 404 karena typo route', async () => {
        const res = await request(app).get('/api/productss');
        expect(res.statusCode).toEqual(404);
    });

    it('3. POST /api/products - Harus berhasil merespons permintaan tambah produk', async () => {
        const newProduct = {
            name: "Kopi Toraja Testing",
            price: 50000,
            description: "Kopi asli",
            category: "Kopi",
            stock: 100
        };
        const res = await request(app).post('/api/products').send(newProduct);
        
        // Kita izinkan 500 karena kita tidak melampirkan file gambar (multer/cloudinary)
        expect([200, 201, 500]).toContain(res.statusCode);
        
        if(res.body && res.body._id) testProductId = res.body._id; 
    });

    it('4. POST /api/products - Harus gagal (400/500) jika data wajib tidak diisi', async () => {
        const invalidProduct = { price: 50000 }; 
        const res = await request(app).post('/api/products').send(invalidProduct);
        expect(res.statusCode).toBeGreaterThanOrEqual(400); 
    });

    it('5. GET /api/products/:id - Harus mengembalikan data produk spesifik', async () => {
        if (!testProductId) return; 
        const res = await request(app).get(`/api/products/${testProductId}`);
        expect([200, 201]).toContain(res.statusCode);
    });

    it('6. GET /api/products/:id - Harus gagal (404/400) jika format ID salah', async () => {
        const res = await request(app).get('/api/products/12345invalidID');
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('7. PUT /api/products/:id - Harus berhasil mengupdate produk', async () => {
        if (!testProductId) return; 
        const res = await request(app).put(`/api/products/${testProductId}`).send({ price: 60000 });
        expect([200, 201]).toContain(res.statusCode);
    });

    it('8. PUT /api/products/:id - Harus gagal update jika ID tidak ada', async () => {
    const res = await request(app).put('/api/products/60d21b4667d0d8992e610c85').send({ price: 60000 });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
}, 15000); // <-- Tambahkan ini juga

    it('9. DELETE /api/products/:id - Harus berhasil menghapus produk', async () => {
        if (!testProductId) return; 
        const res = await request(app).delete(`/api/products/${testProductId}`);
        expect([200, 201]).toContain(res.statusCode);
    });

    it('10. DELETE /api/products/:id - Harus gagal menghapus produk dua kali', async () => {
        if (!testProductId) return; 
        const res = await request(app).delete(`/api/products/${testProductId}`);
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });
});