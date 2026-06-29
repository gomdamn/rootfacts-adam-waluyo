# Revisi Reviewer V5 - Manual Capture Flow

Perubahan utama:
- Klik pertama hanya menyalakan webcam sebagai preview.
- Klik kedua mengambil foto/frame, mematikan webcam, lalu menjalankan inference dan generative fun fact.
- Hasil label, confidence, dan fun fact dikunci agar tidak berubah-ubah saat user membaca.
- Klik tombol lagi berfungsi sebagai scan ulang: state/memory lama dibersihkan, webcam menyala kembali dari awal.
- Fun fact tetap dibuat menggunakan Xenova/Transformers.js berdasarkan label hasil prediksi.
