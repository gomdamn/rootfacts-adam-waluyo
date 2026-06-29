# Revisi Reviewer V4 - Fun Fact Flow

Perbaikan yang dilakukan sesuai catatan reviewer:

1. Setelah objek sayuran terdeteksi dengan confidence cukup, hasil prediksi dikunci.
2. Frame terakhir kamera disimpan ke canvas agar tampilan objek tetap ada.
3. Webcam dimatikan otomatis setelah hasil prediksi dikunci.
4. Hasil label, confidence, dan fun fact tetap tampil sehingga tidak berubah-ubah selama proses inferensi.
5. Tombol scan berikutnya berfungsi sebagai scan ulang: membersihkan state/memory lama, menyalakan webcam kembali, lalu melakukan inferensi dari awal.
6. Fun fact tetap dibuat melalui model lokal Xenova/Transformers.js, bukan daftar fakta statis.
7. Model generatif menggunakan `Xenova/LaMini-Flan-T5-77M` dengan `text2text-generation` dan dtype `q4`, sesuai pola pada modul.
