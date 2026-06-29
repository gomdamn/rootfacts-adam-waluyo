# RootFacts - Advanced MVP Submission

RootFacts adalah aplikasi web AI yang mendeteksi sayuran dari kamera menggunakan TensorFlow.js, lalu membuat fun fact dinamis menggunakan Transformers.js. Project ini memakai starter MVP sesuai jalur advanced.

## Fitur

- Camera streaming berbasis MediaStream API.
- TensorFlow.js model untuk deteksi sayuran.
- Adaptive backend: WebGPU jika tersedia, fallback ke WebGL/CPU.
- Manajemen memori prediksi dengan `tf.tidy()`.
- FPS limit yang dapat dikonfigurasi melalui UI.
- Loading status dengan persentase saat model dimuat.
- Transformers.js untuk fun fact dinamis berdasarkan label sayuran.
- Persona/tone dinamis: Normal, Lucu, Profesional, Santai, Sejarah.
- Copy to clipboard untuk fun fact.
- PWA: manifest, Workbox service worker, precaching aset inti dan model TensorFlow.js.
- ESLint untuk konsistensi kode.

## Menjalankan Lokal

```bash
npm install
npm run start-dev
```

Buka `http://localhost:8080`.

## Build Production

```bash
npm run build
npm run serve
```

## Deployment Netlify

1. Push project ke GitHub.
2. Import repo ke Netlify.
3. Set build command: `npm run build`.
4. Set publish directory: `dist`.
5. Setelah deploy, salin URL Netlify ke `STUDENT.txt`.

## Catatan Pengujian

- Izinkan akses kamera.
- Gunakan objek sayuran di tempat terang dan latar belakang bersih.
- Untuk offline test: buka aplikasi online sekali sampai model termuat, lalu cek DevTools > Application > Service Workers dan Cache Storage.
