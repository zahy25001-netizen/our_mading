# Mading Kita ♡

Mading digital romantis untuk dua orang — sticky notes dengan tulisan, foto, dan voice note.

## Cara menjalankan

Tidak perlu Node.js, database server, atau hosting khusus.

1. Upload **index.html**, **style.css**, dan **script.js** ke repository GitHub.
2. Masuk ke **Settings → Pages**.
3. Pada Source pilih **Deploy from a branch**.
4. Pilih branch `main` dan folder `/ (root)`.
5. Simpan, lalu buka URL GitHub Pages yang diberikan GitHub.

## Fitur

- Sticky notes tanpa batas secara praktis (tergantung storage browser)
- Tulisan sampai 3000 karakter
- Upload foto
- Rekam voice note langsung dari browser
- Audio player pada sticky note
- Drag & drop sticky notes
- Edit, hapus, dan favorit
- Search
- Filter semua / favorit / foto / suara / tulisan
- Sort terbaru / terlama / acak
- 6 warna sticky note
- Dark mode
- Musik latar lokal
- Data tersimpan di IndexedDB browser, sehingga foto/audio tidak perlu dikirim ke server

## Catatan penting tentang GitHub Pages

Website ini bersifat **client-side**. Data mading tersimpan di browser/perangkat yang digunakan. Artinya:

- Kalau kamu membuka website di laptop A, catatan ada di laptop A.
- Membuka URL yang sama di HP B **tidak otomatis melihat catatan dari laptop A**.
- Menghapus data situs/browser dapat menghapus data mading.
- Voice note membutuhkan izin mikrofon.
- GitHub Pages berjalan HTTPS, sehingga fitur mikrofon dapat digunakan.
- File musik lokal tidak dipulihkan setelah refresh karena browser tidak mengizinkan website menyimpan akses permanen ke file perangkat.

Kalau nanti kamu ingin **kalian berdua bisa melihat dan menambah sticky note yang sama dari HP/laptop masing-masing**, versi berikutnya perlu database online seperti Firebase/Supabase. Struktur UI ini sudah dibuat agar mudah dikembangkan ke sana.
