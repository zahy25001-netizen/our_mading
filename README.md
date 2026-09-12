# Mading Kita ♡ — Online Version

Mading digital romantis untuk dua orang. Versi ini memakai **Supabase** agar sticky note, foto, dan voice note bisa disimpan online dan dilihat dari HP/laptop yang berbeda.

## Isi project

- `index.html` — tampilan website
- `style.css` — desain
- `script.js` — logika mading + Supabase
- `supabase-config.js` — URL dan public/anon key Supabase
- `schema.sql` — database, RLS, Storage, RPC room, dan Realtime

## 1. Buat project Supabase

Buka Supabase dan buat project baru.

Di project tersebut:

1. Buka **Authentication → Providers**.
2. Aktifkan **Anonymous Sign-Ins**.
3. Buka **SQL Editor**.
4. Buka file `schema.sql` dari project ini.
5. Copy seluruh isinya ke SQL Editor.
6. Klik **Run**.

SQL tersebut membuat:

- tabel `rooms`
- tabel `room_members`
- tabel `notes`
- Row Level Security (RLS)
- RPC `create_room`
- RPC `join_room`
- private Storage bucket `mading-media`
- policy Storage untuk member room
- Realtime untuk tabel `notes`

## 2. Masukkan konfigurasi Supabase

Buka `supabase-config.js`.

Di Supabase buka **Settings → API** lalu ambil:

- Project URL
- Publishable/anon key

Isi:

```javascript
window.MADING_SUPABASE_URL = "https://xxxxx.supabase.co";
window.MADING_SUPABASE_ANON_KEY = "eyJ...";
```

**Jangan pernah memasukkan `service_role` atau secret key ke file website.**

Public/anon key memang digunakan oleh aplikasi browser, sedangkan keamanan data dijaga oleh RLS di Supabase.

## 3. Jalankan / upload ke GitHub Pages

Setelah konfigurasi di atas selesai, upload semua file project ke repository GitHub:

```text
index.html
style.css
script.js
supabase-config.js
schema.sql
README.md
.gitignore
```

Lalu:

1. GitHub → repository → **Settings**
2. **Pages**
3. Source: **Deploy from a branch**
4. Branch: `main`
5. Folder: `/ (root)`
6. Save

Tunggu GitHub Pages selesai deploy.

## 4. Cara memakai Mading Kita Online

### Kamu

Klik **Buat / Gabung Room** → **Buat room baru**.

Masukkan nama mading dan nama kamu.

Contoh kode:

```text
LOVE-4A7F91C2
```

Bagikan kode tersebut ke pasangan.

### Pasangan

Pasangan membuka URL GitHub Pages yang sama → **Buat / Gabung Room** → **Gabung room** → masukkan kode.

Sekarang kalian berada di room yang sama.

## 5. Fitur online

- Sticky note tersimpan di database online
- Foto disimpan di Supabase Storage
- Voice note disimpan di Supabase Storage
- Foto dan voice memakai signed URL karena bucket dibuat private
- Room code untuk berbagi mading
- Dua orang bisa memakai room yang sama
- Perubahan sticky note disinkronkan melalui Realtime
- Drag & drop posisi note tersimpan online
- Edit, delete, favorite
- Search, filter, sort
- 6 warna sticky note
- Mading memanjang ke bawah tanpa batas ukuran visual tetap
- Dark mode
- Musik lokal browser

## 6. Batasan yang perlu diketahui

**Jumlah sticky note tidak dibatasi oleh kode website.** Batas sebenarnya berasal dari kuota database/storage Supabase dan kapasitas browser/perangkat untuk cache sementara.

Foto dibatasi 8 MB per file pada UI. Voice note mengikuti kemampuan MediaRecorder browser.

Musik latar masih bersifat lokal: file musik yang dipilih tidak di-upload ke database.

## 7. Keamanan

Website menggunakan:

- Anonymous Auth
- Room membership
- Row Level Security
- Private Storage bucket
- Signed URL untuk media

Jadi query database tidak dibuat sebagai tabel publik tanpa perlindungan.

**Penting:** kode room sebaiknya hanya dibagikan kepada pasangan. Untuk keamanan yang lebih tinggi, tahap berikutnya bisa ditambahkan login akun/password atau magic link.
