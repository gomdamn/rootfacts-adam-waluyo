# Revisi Kriteria 2 - Generative AI Fun Fact

Perbaikan berdasarkan catatan reviewer:

- Menghapus daftar fun fact statis/fallback berbasis source code.
- Fun fact sekarang selalu dibuat melalui `Xenova/LaMini-Flan-T5-77M` menggunakan Transformers.js.
- Label hasil prediksi dimasukkan langsung ke prompt: `Write one unique fun fact about <label>`.
- Prompt menjaga agar output hanya membahas label sayuran yang terdeteksi.
- Parameter generasi sudah diatur: `temperature`, `max_new_tokens`, `top_p`, dan `do_sample`.
- UI menampilkan pesan bahwa fun fact sedang dibuat memakai model Xenova/Transformers.js.

Catatan: pada akses pertama, model Transformers.js perlu koneksi internet untuk diunduh. Setelah tersimpan di browser cache, proses berikutnya lebih cepat.
