# PLAN.md — Modul 5 PWA (Bore & Barrel) Kelompok 24

Dokumen ini menjadi satu-satunya sumber instruksi untuk menyelesaikan 7 poin tugas. Seluruh task ditulis agar dapat dieksekusi berurutan oleh developer maupun *coding agent*.

---

## 0. Aturan Eksekusi

| No | Aturan |
|----|--------|
| 1 | Urutan kerja wajib mengikuti **Bagian 4**. Migrasi database dijalankan sebelum kode apa pun yang bergantung pada kolom/tabel baru |
| 2 | Stack tetap *React 19 + Vite 8 + Tailwind 4 + axios + vite-plugin-pwa*. Backend tetap *Supabase PostgREST* (tanpa SDK `@supabase/supabase-js`) |
| 3 | Identitas pengguna tetap UUID anonim dari `getUserIdentifier()` (tanpa *Auth*). Semua fitur "milik sendiri" membandingkan `owner_id` / `user_id` dengan UUID tersebut |
| 4 | Setiap mutasi data wajib memanggil *cache invalidation* (lihat T3) |
| 5 | Seluruh teks UI tetap berbahasa Inggris sesuai kondisi codebase saat ini |
| 6 | Hapus *dead code* peninggalan template (*fallback* `/api/v1/recipes`, field `cook_time`, `ingredients` sebagai alias `specs`) hanya jika tidak mengganggu fitur lain |
| 7 | Setiap task selesai harus lolos `npm run lint` dan `npm run build` |

---

## 1. Hasil Audit Codebase

Repo `danielalfth/modul5pwa2kel24` (satu *commit*, `0393c62`). Struktur utama: `App.jsx` sebagai *state machine* (`tab` + `mode`), tanpa *router*.

### 1.1 Status per poin tugas

| Poin | Kondisi saat ini | Masalah yang ditemukan |
|------|------------------|------------------------|
| 1 *Share link* | `utils/share.js` sudah memakai *Web Share API* + *clipboard fallback*, URL `/?product=<id>` | **Tidak ada kode yang membaca `?product=`**, sehingga tautan hanya membuka katalog. Fallback slug berbasis nama tidak dapat di-*resolve*. Tombol di kartu tidak memberi *feedback* |
| 2 *Lazy load* | `LazyImage.jsx` memakai `loading="lazy"` + *skeleton* | Hanya 3 file SVG dipakai ulang oleh 6 produk, sehingga *Network* hanya menampilkan 3 request dan pemuatan bertahap tidak terlihat. Seed hanya 6 produk (seluruhnya muat di *viewport*). Halaman belum di-*code split* |
| 3 *Query caching* | `utils/queryCache.js` berupa `Map` di memori, TTL 5 menit | Cache **hilang saat reload** sehingga tidak pernah menghasilkan *disk cache*. Mutasi (create/edit/delete) **tidak meng-invalidasi** cache `guns:*`, sehingga produk baru tidak muncul hingga 5 menit. Gambar tidak punya header `Cache-Control` yang layak. Seluruh `*.svg/png` masuk *precache* SW sehingga akan tampil `(ServiceWorker)` dan bukan `(disk cache)` |
| 4 *Profile* | `ProfilePage.jsx` sudah bertab (Overview, Drafts, About, Contact). `EditProfilePage` sudah terpisah | `About.jsx`/`Contact.jsx` dan rute `tab === 'About'/'Contact'` di `App.jsx` masih tersisa. Draft hanya berupa *form state* di `localStorage`, belum dapat dibuka kembali (prop `onOpenDraft` didokumentasikan tetapi tidak terhubung) dan bukan "list katalog draft" |
| 5 *Soft delete* | `deleteGun()` menjalankan `DELETE` permanen | Skema belum punya kolom arsip. Tidak ada halaman arsip, *restore*, maupun hapus permanen |
| 6 *Review* | `updateReview`/`deleteReview` ada di service | UI belum menampilkan edit/delete. `getReviews()` **membuang `user_id`** sehingga kepemilikan review tidak dapat ditentukan. Belum ada tabel *vote*. Constraint `UNIQUE(product_id,user_id)` belum ditangani (error 409) |
| 7 *Multi gambar* | `products.image_url` bertipe `TEXT` tunggal | Tidak ada tabel gambar. `uploadService` memakai bucket **`guns`**, sedangkan SQL membuat policy untuk **`product-images`**. Policy storage hanya untuk role `authenticated`, sedangkan app memakai *anon key*, sehingga upload gagal dan jatuh ke **base64 yang tersimpan ke kolom `image_url`** |

### 1.2 Masalah lintas fitur

| Area | Masalah | Tindakan |
|------|---------|----------|
| Env/Vercel | `.env.example` mengarah ke `modlima.fuadfakhruz.id` dan tidak memuat `VITE_SUPABASE_PUBLISHABLE_KEY`. Tanpa key, `IS_SUPABASE=false` dan app memanggil API yang salah | Perbarui `.env.example`, set *env var* di Vercel |
| Routing | Tanpa *router*, tidak ada URL per halaman | Tambah `react-router-dom` (T0) |
| State ganda | `Catalog.jsx` dan `App.jsx` sama-sama menyimpan `selectedGun` dan merender `GunDetail` | Hapus dari `Catalog.jsx`, detail dikelola *route* |
| File sisa | `src/components/GunCard.jsx` (1 baris), `About.jsx`, `Contact.jsx`, `dev-dist/` ter-*commit* | Hapus dan tambahkan `dev-dist` ke `.gitignore` |
| Data hilang | Field `steps` dikirim form tetapi tidak ada kolom `steps` di DB | Simpan ke `specs` (JSONB) atau hapus dari form. Default pada rencana ini: hapus *steps* dari tampilan bila kosong |
| Keamanan | Policy RLS `FOR ALL USING (true)` untuk `anon`, sehingga siapa pun dapat mengubah/menghapus data lewat API | Dibiarkan sesuai skema tugas. Pembatasan kepemilikan hanya di sisi klien. Dicatat pada bagian analisis laporan |

---

## 2. Keputusan Teknis

| Topik | Keputusan | Alasan |
|-------|-----------|--------|
| Routing | `react-router-dom` (BrowserRouter) | URL bersih `/catalog/:id`, mendukung tombol *back* browser, dibutuhkan halaman arsip dan edit profil |
| Format share link | `https://<domain-vercel>/catalog/<id>` | Mengarah langsung ke katalog spesifik |
| Fallback SPA di Vercel | `vercel.json` dengan *rewrite* ke `/index.html` | Tanpa ini membuka `/catalog/5` langsung akan 404 |
| Kepemilikan katalog | Kolom `products.owner_id UUID` | Dibutuhkan untuk Draft, Arsip, dan tombol edit/hapus milik sendiri |
| Draft | Kolom `products.status` (`draft` / `published`) | Draft tersimpan di DB, dapat dilihat sebagai list katalog di Profile dan dilanjutkan editnya |
| Soft delete | Kolom `products.archived_at TIMESTAMPTZ` | `NULL` berarti aktif. Terisi berarti diarsip |
| Multi gambar | Tabel `product_images` + `products.image_url` sebagai *cover* | Kompatibel dengan kartu katalog yang hanya butuh satu gambar |
| Vote review | Tabel `review_votes (review_id, user_id, vote)` | Satu vote per user per review, dapat diubah/dicabut |
| Caching data | Cache memori + persistensi `localStorage` + *stale-while-revalidate* + invalidasi berbasis *tag* | Cache bertahan setelah reload dan selalu konsisten setelah mutasi |
| Caching gambar | Header `Cache-Control: max-age=31536000` pada objek storage dan aset statis. **Tanpa** `runtimeCaching` untuk gambar | Indikator **disk cache** muncul dari HTTP cache. Jika dilayani SW, kolom *Size* menampilkan `(ServiceWorker)` |
| Lazy load | `IntersectionObserver` (`rootMargin: 200px`) + `loading="lazy"` + `React.lazy` untuk halaman | Perilaku konsisten di semua browser dan dapat diamati di tab *Network* |

---

## 3. Migrasi Database

Jalankan di *Supabase SQL Editor* setelah skema pada `database.md`. Skrip bersifat idempoten.

```sql
-- =====================================================
-- A. KOLOM BARU PADA PRODUCTS
-- =====================================================
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS owner_id UUID,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products
    ADD CONSTRAINT products_status_check CHECK (status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS idx_products_owner
    ON public.products (owner_id);
CREATE INDEX IF NOT EXISTS idx_products_visibility
    ON public.products (status, archived_at, created_at DESC);

-- =====================================================
-- B. TABEL GAMBAR PRODUK (MULTI IMAGE)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.product_images (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL
        REFERENCES public.products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    storage_path TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product
    ON public.product_images (product_id, position);

-- Backfill gambar lama sebagai gambar pertama
INSERT INTO public.product_images (product_id, url, position)
SELECT p.id, p.image_url, 0
FROM public.products p
WHERE p.image_url IS NOT NULL
  AND p.image_url NOT LIKE 'data:%'
  AND NOT EXISTS (
      SELECT 1 FROM public.product_images i WHERE i.product_id = p.id
  );

-- =====================================================
-- C. VOTE REVIEW (LIKE / DISLIKE)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.review_votes (
    review_id BIGINT NOT NULL
        REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id)
);

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =====================================================
-- D. RLS DAN HAK AKSES TABEL BARU
-- =====================================================
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.product_images TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.review_votes TO anon, authenticated;

GRANT USAGE, SELECT
ON SEQUENCE public.product_images_id_seq TO anon, authenticated;

DROP POLICY IF EXISTS "Allow public all on product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow authenticated all on product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow public all on review_votes" ON public.review_votes;
DROP POLICY IF EXISTS "Allow authenticated all on review_votes" ON public.review_votes;

CREATE POLICY "Allow public all on product_images"
ON public.product_images FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated all on product_images"
ON public.product_images FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow public all on review_votes"
ON public.review_votes FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated all on review_votes"
ON public.review_votes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- =====================================================
-- E. STORAGE — AKSES ANON (APP TANPA AUTH)
--    Bucket product-images harus berstatus PUBLIC.
-- =====================================================
DROP POLICY IF EXISTS "Anon can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon can delete product images" ON storage.objects;

CREATE POLICY "Anon can upload product images"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anon can update product images"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anon can delete product images"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'product-images');

-- =====================================================
-- F. DIAGNOSTIK — BERSIHKAN BASE64 YANG TERLANJUR TERSIMPAN
-- =====================================================
-- SELECT id, name, LEFT(image_url, 30) FROM public.products
-- WHERE image_url LIKE 'data:%';
-- UPDATE public.products SET image_url = '/guns/pistol.svg'
-- WHERE image_url LIKE 'data:%';
```

> Opsional untuk poin 2. Tambahkan minimal 6 produk seed lagi (total ≥ 12) dengan gambar yang berbeda agar *lazy load* terlihat saat *scroll*.

---

## 4. Urutan Pengerjaan

| Fase | Task | Bergantung pada |
|------|------|-----------------|
| 1 | Migrasi database (Bagian 3) dan konfigurasi *env* | — |
| 2 | **T0** Fondasi (router, pembersihan, `vercel.json`, perbaikan upload) | Fase 1 |
| 3 | **T7** Multi gambar | T0 |
| 4 | **T5** *Soft delete* / arsip | T0 |
| 5 | **T4** Profile (draft, about, contact, edit profil) | T0, T5 |
| 6 | **T6** Review (edit, delete, vote) | T0 |
| 7 | **T1** *Share link* | T0 |
| 8 | **T2** *Lazy load* | T7 |
| 9 | **T3** *Query caching* | Seluruh mutasi sudah final |
| 10 | Deploy Vercel, pengujian, tangkapan layar, laporan | Semua |

---

## 5. Task per Poin

### T0 — Fondasi

| # | Task | File |
|---|------|------|
| 0.1 | `npm i react-router-dom`. Bungkus `<App/>` dengan `BrowserRouter` | `main.jsx` |
| 0.2 | Ubah `App.jsx` menjadi layout + `<Routes>` | `App.jsx` |
| 0.3 | Hapus `selectedGun`, `deleteTarget`, dan render `GunDetail` dari `Catalog.jsx`. Kartu memanggil `navigate('/catalog/:id')` | `pages/Catalog.jsx` |
| 0.4 | Hapus `components/GunCard.jsx`, `pages/About.jsx`, `pages/Contact.jsx`. Tambah `dev-dist/` ke `.gitignore` dan hapus dari repo (`git rm -r --cached dev-dist`) | — |
| 0.5 | `Header` memakai `NavLink` | `components/Header.jsx` |
| 0.6 | Perbaiki `.env.example` (lihat Bagian 6) | `.env.example` |
| 0.7 | Ganti `bucketName = 'guns'` menjadi `'product-images'`. **Hapus fallback base64**, tampilkan error dan opsi *retry* | `services/uploadService.js` |
| 0.8 | Buat `vercel.json` (Bagian 6) | `vercel.json` |
| 0.9 | Tambah `owner_id` (`getUserIdentifier()`) dan `status` pada payload `createGun` | `services/gunService.js` |

Rute akhir

| Path | Halaman |
|------|---------|
| `/` | Catalog |
| `/catalog/:id` | Detail katalog (target *share link*) |
| `/create` | Create |
| `/edit/:id` | Edit |
| `/favorites` | Favorites |
| `/profile` | Profile |
| `/profile/edit` | Edit Profile |
| `*` | *Not Found* |

**Acceptance.** Semua rute dapat dibuka langsung lewat URL di *localhost* maupun Vercel. Tombol *back* browser berfungsi.

---

### T1 — *Share Link* Button

| # | Task | File |
|---|------|------|
| 1.1 | `getProductShareUrl(product)` menghasilkan `${origin}/catalog/${product.id}`. Hapus fallback slug nama | `utils/share.js` |
| 1.2 | Buat `pages/GunDetailPage.jsx`. Ambil `id` dari `useParams`, muat data dengan `useGunById`, tangani *loading*, *error*, dan *not found* (termasuk produk diarsip/draft milik orang lain) | `pages/GunDetailPage.jsx` |
| 1.3 | Tombol *share* pada kartu dan halaman detail memakai *Web Share API*, lalu *clipboard fallback*. Tampilkan *toast* "Link copied" pada keduanya | `GunCard.jsx`, `GunDetail.jsx`, komponen `Toast` baru |
| 1.4 | Set `document.title` dan `<meta name="description">` dinamis pada halaman detail | `GunDetailPage.jsx` |
| 1.5 | Sembunyikan tombol share pada produk lokal (`local-*`) | `GunCard.jsx` |

**Acceptance.** Salin link dari katalog A, buka di tab *incognito* atau perangkat lain, maka langsung tampil detail katalog A (bukan beranda).

**Bukti laporan.** Tangkapan layar tombol share, *toast*, URL hasil, dan hasil pembukaan tautan di tab baru.

---

### T2 — *Lazy Load*

| # | Task | File |
|---|------|------|
| 2.1 | Tulis ulang `LazyImage` dengan `IntersectionObserver` (`rootMargin: '200px'`). Atribut `src` baru diisi setelah elemen mendekati *viewport*. Pertahankan `loading="lazy"`, `decoding="async"`, *skeleton*, `aspect-ratio`, dan *fallback* error | `components/common/LazyImage.jsx` |
| 2.2 | Pakai `React.lazy` + `Suspense` untuk `CreateGunPage`, `EditGunPage`, `ProfilePage`, `EditProfilePage`, `GunDetailPage` | `App.jsx` |
| 2.3 | Pada galeri detail, hanya gambar aktif yang dimuat langsung. *Thumbnail* lain memakai `LazyImage` | `components/gun/ImageGallery.jsx` |
| 2.4 | Tambah seed ≥ 12 produk dengan gambar unik (Bagian 3) | SQL / Supabase |

**Pengujian (sesuai catatan tugas).**

| Langkah | Hasil yang diharapkan |
|---------|-----------------------|
| DevTools → *Network* → filter `Img` → *Disable cache* aktif → reload | Hanya gambar pada *viewport* awal yang muncul |
| Buka halaman katalog dan *scroll* perlahan | Request gambar bertambah bertahap seiring *scroll* |
| Tangkapan layar sebelum dan sesudah *scroll* | Jumlah request meningkat |

---

### T3 — *Query Caching*

**Layer A — data API**

| # | Task | File |
|---|------|------|
| 3.1 | Refactor `queryCache.js` menjadi cache dua lapis (memori + `localStorage`, prefix `bb_cache_`). Entri menyimpan `{data, expires, tags}`. Tangani `QuotaExceededError` | `utils/queryCache.js` |
| 3.2 | Tambah `invalidateByTag(tag)` dengan tag `guns`, `gun:<id>`, `reviews:<id>`, `favorites`, `archive` | `utils/queryCache.js` |
| 3.3 | Terapkan pola *stale-while-revalidate*. Tampilkan data cache langsung, lalu *revalidate* di latar belakang bila usia > 60 detik | `hooks/useGuns.js`, `useReviews.js`, `useFavorites.js` |
| 3.4 | Tambah cache pada `useGunById` (saat ini belum ada) | `hooks/useGuns.js` |
| 3.5 | Panggil `invalidateByTag` setelah **setiap** mutasi (create, update, archive, restore, delete permanen, review, vote, favorit, upload gambar) | seluruh `services/*` atau hook mutasi |

**Layer B — gambar (target indikator *disk cache*)**

| # | Task | File |
|---|------|------|
| 3.6 | Upload ke Supabase Storage dengan header `cache-control: max-age=31536000` dan nama file unik per upload (*immutable*) | `services/uploadService.js` |
| 3.7 | Tambah header `Cache-Control: public, max-age=31536000, immutable` untuk `/assets/*` dan `/guns/*` di `vercel.json` | `vercel.json` |
| 3.8 | Keluarkan `guns/**` dari `workbox.globPatterns` (hanya *precache* ikon, JS, CSS, HTML). Pertahankan satu gambar *fallback* | `vite.config.js` |
| 3.9 | Pastikan **tidak ada** `runtimeCaching` untuk gambar dan endpoint Supabase | `vite.config.js` |

**Pengujian (sesuai catatan tugas).**

| Langkah | Hasil yang diharapkan |
|---------|-----------------------|
| *Network* → filter `Img` → reload pertama | Kolom *Size* menampilkan ukuran file |
| Reload kedua (tanpa *Disable cache*) | Kolom *Size* menampilkan `(disk cache)` |
| Katalog dibuka ulang setelah reload | Data tampil instan dari cache, lalu *revalidate* |
| Tambah katalog baru lalu kembali ke beranda | Katalog baru langsung muncul (invalidasi berfungsi) |

---

### T4 — *Profile*

| # | Task | File |
|---|------|------|
| 4.1 | Ubah `ProfilePage` menjadi satu halaman dengan *section* berurutan (navigasi anchor opsional). Susunan: Identitas + tombol **Edit Profile**, Statistik, **Drafts**, **Archive** (T5), **About**, **Contact** | `pages/ProfilePage.jsx` |
| 4.2 | Pindahkan konten About dan Contact menjadi *section* di Profile. Hapus rute dan file lama (T0.4) | `ProfilePage.jsx` |
| 4.3 | Tombol **Edit Profile** menuju `/profile/edit`. Pastikan tidak ada form edit tersisa di halaman Profile. Verifikasi `EditProfilePage` menyimpan *username*, *bio*, *avatar* | `ProfilePage.jsx`, `EditProfilePage.jsx` |
| 4.4 | Kompres avatar (≤ 256 px) sebelum disimpan agar tidak membebani `localStorage` | `EditProfilePage.jsx`, `userService.js` |
| 4.5 | **Draft di DB.** Tambah tombol **Save as Draft** pada Create/Edit. Simpan dengan `status='draft'`. Field wajib `name` dan `type` diberi nilai bawaan (`Untitled draft`, `Uncategorized`) bila kosong | `CreateGunPage.jsx`, `EditGunPage.jsx`, `gunService.js` |
| 4.6 | Section **Drafts** menampilkan list katalog (`owner_id = user` dan `status = draft` dan `archived_at IS NULL`) berisi *cover*, nama, tipe, waktu ubah, tombol **Continue editing** (`/edit/:id`), **Publish**, dan **Delete** (masuk arsip) | `ProfilePage.jsx`, komponen `DraftList.jsx` |
| 4.7 | Hapus alur draft `localStorage` lama dan modal *load draft* (atau migrasikan satu kali ke DB) | `CreateGunPage.jsx`, `utils/draftStorage.js` |
| 4.8 | Katalog publik hanya menampilkan `status = published` | `gunService.getGuns` |

**Acceptance.** About dan Contact tidak ada lagi di *navbar* maupun sebagai halaman terpisah. Draft muncul sebagai list katalog dan dapat dilanjutkan.

---

### T5 — *Soft Delete* / Arsip

| # | Task | File |
|---|------|------|
| 5.1 | Service `archiveGun(id)` → `PATCH products?id=eq.:id` dengan `archived_at = now()` | `gunService.js` |
| 5.2 | `restoreGun(id)` → `archived_at = null` | `gunService.js` |
| 5.3 | `deleteGunPermanent(id)` → hapus objek storage terkait (`product_images.storage_path`), lalu `DELETE products?id=eq.:id` | `gunService.js`, `uploadService.js` |
| 5.4 | `getArchivedGuns(ownerId)` → `archived_at=not.is.null&owner_id=eq.:ownerId` | `gunService.js` |
| 5.5 | Semua query publik menambah filter `archived_at=is.null&status=eq.published` | `gunService.js` |
| 5.6 | Query favorit menyembunyikan produk yang diarsip (`products!inner(*)` + filter `products.archived_at=is.null`) | `favoriteService.js` |
| 5.7 | Ganti tombol **Delete** pada kartu dan detail menjadi **Archive**. Modal konfirmasi diperbarui ("Move to archive?") | `GunCard.jsx`, `GunDetail.jsx`, `ConfirmModal.jsx` |
| 5.8 | Section **Archive** di Profile. Tiap item memiliki **Restore** dan **Delete permanently** (konfirmasi dua langkah) | `ProfilePage.jsx`, komponen `ArchiveList.jsx` |
| 5.9 | Tombol edit/archive hanya tampil bila `owner_id === getUserIdentifier()` | `GunCard.jsx`, `GunDetail.jsx` |

**Acceptance.** Katalog diarsip → hilang dari beranda dan favorit → muncul di Archive → *Restore* mengembalikan ke beranda → *Delete permanently* menghapus baris dan file gambar.

---

### T6 — *Review*

| # | Task | File |
|---|------|------|
| 6.1 | `getReviews` memakai `select=*,review_votes(user_id,vote)`. Petakan menjadi `{ id, user_id, isMine, rating, comment, created_at, updated_at, likes, dislikes, myVote }` | `reviewService.js` |
| 6.2 | `updateReview` mengisi `updated_at`. Tampilkan label "edited" | `reviewService.js`, `GunDetail.jsx` |
| 6.3 | `voteReview(reviewId, vote)` → `POST /rest/v1/review_votes?on_conflict=review_id,user_id` dengan header `Prefer: resolution=merge-duplicates`. Menekan tombol yang sama sekali lagi memanggil `DELETE` (cabut vote) | `reviewService.js` |
| 6.4 | Pada review milik sendiri tampil tombol **Edit** (form *inline*, rating + komentar) dan **Delete** (dengan `ConfirmModal`) | `components/gun/ReviewItem.jsx` |
| 6.5 | Pada review orang lain tampil **thumbs up** dan **thumbs down** beserta jumlahnya. Tombol aktif menandai `myVote`. Pada review sendiri tombol vote dinonaktifkan | `ReviewItem.jsx` |
| 6.6 | Tangani constraint `UNIQUE(product_id, user_id)`. Jika pengguna sudah punya review, form kirim disembunyikan dan diganti review miliknya beserta tombol edit. Error 409 diterjemahkan menjadi pesan yang jelas | `GunDetail.jsx`, `useReviews.js` |
| 6.7 | *Optimistic update* untuk vote, rollback bila gagal. Invalidasi tag `reviews:<id>` | `useReviews.js` |
| 6.8 | Pecah `GunDetail.jsx` (259 baris) menjadi `ReviewSection`, `ReviewForm`, `ReviewItem` | `components/gun/` |

**Acceptance.** Review sendiri dapat diedit dan dihapus. Review orang lain dapat di-like atau di-dislike, berpindah dari like ke dislike, dan dicabut. Jumlah vote konsisten setelah reload.

---

### T7 — Multi Gambar per Katalog

| # | Task | File |
|---|------|------|
| 7.1 | Komponen `MultiImageUploader` dengan `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`. Fitur *preview*, hapus, urutkan (naik/turun), dan tandai **cover** | `components/gun/MultiImageUploader.jsx` |
| 7.2 | Validasi per file (tipe dan ≤ 5 MB) dan batas jumlah (default **5 gambar**) | `MultiImageUploader.jsx` |
| 7.3 | Kompres klien lewat `canvas` (sisi terpanjang 1280 px, kualitas 0.82, WebP bila didukung) sebelum upload | `utils/imageCompress.js` |
| 7.4 | `uploadImages(files, productId)` mengunggah paralel (maks 3 sekaligus) ke `product-images/products/<productId>/<uuid>.<ext>`, menampilkan progres per file | `uploadService.js` |
| 7.5 | Simpan baris ke `product_images` (`url`, `storage_path`, `position`) dan set `products.image_url` ke gambar *cover* (posisi 0) | `gunService.js` |
| 7.6 | Alur Create: buat produk → unggah gambar → simpan `product_images` → set cover. Jika upload gagal, produk tetap tersimpan sebagai draft dan pengguna diberi opsi *retry* | `CreateGunPage.jsx` |
| 7.7 | Alur Edit: muat gambar existing, mendukung tambah, hapus (baris + objek storage), dan ubah urutan | `EditGunPage.jsx` |
| 7.8 | Detail memakai `ImageGallery` (gambar utama + *thumbnail*, navigasi panah, *swipe* di mobile) | `components/gun/ImageGallery.jsx` |
| 7.9 | `getGunById` memakai `select=*,product_images(id,url,position)&order=position` pada relasi gambar. List katalog tetap memakai `image_url` | `gunService.js` |
| 7.10 | Pecah `CreateGunPage.jsx` (711 baris) dan `EditGunPage.jsx` (610 baris) dengan komponen form bersama `GunForm.jsx` agar tidak duplikasi | `components/gun/GunForm.jsx` |

**Acceptance.** Satu katalog dapat memiliki hingga 5 gambar, dapat diubah urutannya, dan tampil sebagai galeri di halaman detail. Tidak ada nilai `data:` pada kolom `image_url`.

---

## 6. Konfigurasi Vercel dan Environment

### 6.1 `.env.example`

```env
# Supabase project URL (tanpa trailing slash)
VITE_API_BASE_URL=https://<project-ref>.supabase.co
# Supabase publishable / anon key
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

### 6.2 `vercel.json`

```json
{
  "rewrites": [{ "source": "/((?!assets/|guns/|.*\\..*).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/guns/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    }
  ]
}
```

### 6.3 Langkah deploy

| No | Langkah |
|----|---------|
| 1 | Push ke GitHub (branch `main`) |
| 2 | Vercel → *Add New Project* → impor repo. *Framework Preset* **Vite**, *Build Command* `npm run build`, *Output* `dist` |
| 3 | *Settings → Environment Variables* → isi `VITE_API_BASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` untuk *Production*, *Preview*, dan *Development* |
| 4 | *Redeploy* setelah env diisi (variabel `VITE_*` ditanam saat *build*) |
| 5 | Verifikasi di URL Vercel: *Application → Manifest*, *Service Workers*, dan *Install* |
| 6 | Tulis link Vercel pada laporan |

---

## 7. Checklist Pengujian dan Bukti Laporan

| Poin | Skenario uji | Bukti (tangkapan layar) |
|------|--------------|-------------------------|
| 1 | Klik share → tempel link di tab baru → detail katalog terbuka | Tombol + toast, URL `/catalog/:id`, hasil di tab baru |
| 2 | *Network* → `Img` → reload → *scroll* katalog | Daftar request sebelum dan sesudah *scroll* |
| 3 | Reload dua kali pada filter `Img` | Kolom *Size* bertuliskan `(disk cache)`, serta bukti katalog baru langsung muncul |
| 4 | Buka Profile | Section Edit Profile (tombol), Drafts, Archive, About, Contact. Halaman Edit Profile |
| 5 | Arsipkan → cek Archive → Restore → arsipkan lagi → Delete permanently | Setiap tahap, modal konfirmasi |
| 6 | Buat review → edit → hapus. Vote review milik akun/UUID lain | Form edit, konfirmasi hapus, tombol like/dislike dengan hitungan |
| 7 | Unggah 3–5 gambar → atur urutan → simpan → buka detail | Form multi upload, galeri di detail, baris `product_images` di Supabase |
| Semua | `npm run build` dan `npm run lint` bersih. Lighthouse PWA | Hasil Lighthouse, link Vercel |

> Untuk menguji review/vote milik orang lain, buka aplikasi di *incognito* atau browser berbeda agar mendapat UUID baru.

---

## 8. Kerangka Analisis Laporan (per poin)

| Poin | Hal yang dianalisis |
|------|---------------------|
| 1 | Perbandingan *query param* vs *path routing*, peran `vercel.json` *rewrite*, perilaku *Web Share API* vs *clipboard fallback*, keterbatasan *link preview* pada SPA |
| 2 | Cara kerja `IntersectionObserver` dan `loading="lazy"`, dampak terhadap *initial load*, jumlah request, dan *Largest Contentful Paint*. *Code splitting* halaman |
| 3 | Perbedaan cache memori, `localStorage`, HTTP cache (*disk cache*), dan *Service Worker cache*. Alasan gambar tidak diarahkan ke SW. Strategi TTL, SWR, dan invalidasi |
| 4 | Pengelompokan informasi pada Profile, alur draft berbasis kolom `status`, pemisahan *Edit Profile* |
| 5 | Perbandingan *soft delete* vs *hard delete*, kolom `archived_at`, indeks, pemulihan data, penghapusan file storage |
| 6 | Model data `review_votes`, constraint `UNIQUE`, *optimistic update*, pembatasan aksi berdasarkan UUID, serta keterbatasan tanpa *Auth* |
| 7 | Desain relasi `product_images`, kompresi klien, penyimpanan di *Supabase Storage*, masalah *base64* pada kolom DB |
| Umum | Risiko keamanan RLS terbuka (`USING (true)`) dan kepemilikan yang hanya divalidasi di klien |

---

## 9. Pertanyaan Terbuka (menentukan default pada rencana ini)

| No | Pertanyaan | Default bila tidak dijawab |
|----|------------|----------------------------|
| 1 | Data seed lama tidak memiliki `owner_id`. Apakah tombol edit/arsip boleh tampil untuk semua pengguna pada data tersebut? | Seed lama **hanya dapat dilihat**. Edit/arsip hanya untuk katalog yang dibuat sendiri |
| 2 | Draft disimpan di DB (kolom `status`) atau cukup `localStorage`? | **DB** |
| 3 | Penggunaan `react-router-dom` disetujui? | **Ya** |
| 4 | Apakah tersedia gambar asli untuk tambahan seed (≥ 12 produk), atau cukup gambar *placeholder* unik? | Placeholder unik |
| 5 | Apakah project Supabase sudah memiliki bucket **`product-images`** berstatus *public*, dan URL serta key sudah tersedia? | Bucket dibuat manual sebelum Fase 1 |
| 6 | Batas jumlah gambar per katalog | **5** |
