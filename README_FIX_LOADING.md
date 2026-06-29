# Fix Loading / Blank Page

Versi ini memperbaiki masalah halaman stuck di "Memuat..." dengan cara:

1. TensorFlow.js tidak lagi di-bundle dari npm, tetapi dimuat dari CDN versi 4.22.0 sesuai hint.
2. Backend WebGPU tidak lagi di-import statis. Aplikasi mengecek `navigator.gpu` dan fallback ke WebGL/CPU.
3. Transformers.js dimuat secara dynamic import dari CDN saat background/fun fact, sehingga UI dan kamera tidak menunggu model teks yang besar.
4. Service Worker otomatis dimatikan di localhost agar cache PWA lama tidak menyebabkan halaman stuck.

Cara run:

```bash
rm -rf node_modules package-lock.json
npm config set registry https://registry.npmjs.org/
npm install --ignore-scripts --registry=https://registry.npmjs.org/
npm run build
npm run start-dev
```

Buka `http://localhost:8080`.

Kalau masih muncul versi lama, buka DevTools > Application > Storage > Clear site data, lalu refresh dengan Cmd+Shift+R.
