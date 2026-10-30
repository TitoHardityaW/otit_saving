# otit_saving

Aplikasi web sederhana untuk mencatat **uang masuk dan keluar**, dengan **Google Sheets** sebagai database. Frontend berupa file statis (HTML/CSS/JS) sehingga bisa di-hosting gratis di **GitHub Pages**.

```
Browser (GitHub Pages)  ──fetch──▶  Google Apps Script Web App  ──▶  Google Spreadsheet
  index.html, app.js                 apps-script/Code.gs              sheet "Transaksi"
```

## Fitur

- Tambah, ubah, dan hapus transaksi (tanggal, jenis, kategori, keterangan, jumlah)
- **Soft delete**: transaksi yang dihapus tidak dibuang dari spreadsheet, hanya kolom `Status` diubah dari `1` (aktif) menjadi `0` (dihapus)
- Ringkasan saldo keseluruhan, serta total masuk, keluar, dan selisih per bulan
- Filter per bulan, jenis, dan pencarian teks
- Rincian pengeluaran per kategori
- Ekspor data yang tampil ke CSV
- Dilindungi PIN, tampilan responsif (HP & desktop), mendukung mode gelap
- **PWA**: bisa di-install ke layar utama HP/desktop dan tampilan aplikasi tetap terbuka saat offline (data tetap butuh internet)

## 1. Setup Google Sheets (backend)

1. Buat Google Spreadsheet baru di <https://sheets.new>, beri nama misalnya **Otit Saving**.
2. Buka menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, lalu salin seluruh isi file [apps-script/Code.gs](apps-script/Code.gs) ke sana. Simpan.
4. Atur PIN: klik **⚙ Project Settings** → bagian **Script Properties** → **Add script property**
   - Property: `APP_PIN`
   - Value: PIN pilihan Anda (misal `482913`)
5. Deploy: klik **Deploy → New deployment** → ikon ⚙ pilih **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**, izinkan akses (Authorize) bila diminta.
6. Salin **Web app URL** (berakhiran `/exec`).

Sheet `Transaksi` beserta header-nya akan dibuat otomatis saat pertama kali dipakai, dengan kolom:

| ID | Tanggal | Jenis | Kategori | Keterangan | Jumlah | Dibuat | Diubah | Status |
|----|---------|-------|----------|------------|--------|--------|--------|--------|

`Status` bernilai `1` untuk transaksi aktif dan `0` untuk yang sudah dihapus. Baris lama yang kolom `Status`-nya kosong dianggap aktif. Untuk memulihkan transaksi yang terhapus, ubah `Status`-nya kembali menjadi `1` langsung di spreadsheet.

> Bila nanti `Code.gs` diubah, lakukan **Deploy → Manage deployments → Edit (✏) → Version: New version → Deploy** agar URL tetap sama.

## 2. Konfigurasi frontend

Isi URL Web App di [config.js](config.js):

```js
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};
```

Alternatifnya biarkan kosong dan isi URL lewat menu **⚙ Pengaturan** di aplikasi (tersimpan di browser).

**PIN tidak pernah ditulis di repo.** PIN diminta saat pertama kali membuka aplikasi dan disimpan di `localStorage` browser tersebut.

## 3. Publish ke GitHub Pages

1. Push repo ini ke GitHub.
2. Di repo GitHub: **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → **Save**.
3. Tunggu 1–2 menit, aplikasi tersedia di `https://<username>.github.io/otit_saving/`.

## Install sebagai aplikasi (PWA)

- **Android / Chrome / Edge**: buka situsnya, lalu klik tombol **⤓ Install** di kanan atas (atau menu browser → *Install app* / *Tambahkan ke layar utama*).
- **iPhone / iPad (Safari)**: tombol Share → **Add to Home Screen**.

PWA membutuhkan HTTPS. GitHub Pages sudah HTTPS, dan `http://localhost` juga diizinkan untuk uji coba.

Setiap kali file aplikasi diubah, naikkan `CACHE_VERSION` di [sw.js](sw.js) (misal `v1` → `v2`) agar pengguna mendapatkan versi terbaru. Perubahan biasanya baru terlihat setelah halaman dibuka ulang sekali lagi.

## Menjalankan secara lokal

Cukup buka lewat XAMPP: `http://localhost/otit_saving/`, atau web server statis apa pun.

## Catatan keamanan

- URL Web App bersifat publik, tetapi setiap permintaan wajib menyertakan PIN yang cocok dengan `APP_PIN`. Gunakan PIN yang tidak mudah ditebak.
- Data asli ada di Google Spreadsheet Anda; spreadsheet itu tetap bisa dibuka dan diedit langsung.
- Untuk mengganti PIN, ubah `APP_PIN` di Script Properties lalu masukkan PIN baru di menu Pengaturan aplikasi.
