import http from 'k6/http';
import { sleep, check } from 'k6';

// Konfigurasi Pengujian
export let options = {
    vus: 50,           // Simulasi 50 pengguna maya (Virtual Users) mengakses bersamaan
    duration: '10s',   // Pengujian dilakukan selama 10 detik
};

export default function () {
    // Kita targetkan endpoint produk dari server lokalmu
    let res = http.get('http://localhost:5000/api/products'); 
    
    // Pengecekan apakah response-nya sukses (200) dan cepat (< 500ms)
    check(res, {
        'status is 200 (sukses)': (r) => r.status === 200,
        'waktu respon < 500ms': (r) => r.timings.duration < 500,
    });
    
    sleep(1); // Jeda 1 detik antar request tiap user
}