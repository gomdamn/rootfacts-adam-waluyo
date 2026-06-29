# Revisi Fun Fact Xenova v2

Perbaikan untuk catatan reviewer Kriteria 2:

- Fun fact dibuat melalui Xenova/Transformers.js, bukan fallback statis.
- Menggunakan model `Xenova/flan-t5-small` dengan task `text2text-generation`.
- Prompt selalu memasukkan label hasil prediksi dan melarang model membahas sayuran lain.
- Prediksi harus stabil minimal 1,2 detik dan confidence minimal 55% sebelum fun fact dibuat.
- Jika label berubah ketika model sedang generate, hasil lama diabaikan agar fun fact tetap relevan dengan label yang tampil.
- Tidak ada daftar fun fact statis di source code.
