# PLAN_DB_MIGRATION.md — Pindah ke Database Supabase Milik Sendiri

Dokumen ini melengkapi `PLAN.md`. Cakupan terbatas pada migrasi backend dari database asisten praktikan ke project Supabase milik sendiri, termasuk penyesuaian kode agar sesuai skema.

---

## 1. Diagnosis

| Item | Temuan |
|------|--------|
| Gejala | Setelah upload gambar (percobaan ke-2) muncul `Could not find the 'owner_id' column of 'products' in the schema cache` |
| Sumber pesan | Pesan berasal dari *PostgREST* (lapisan REST Supabase). Artinya request `POST /rest/v1/products` memuat kolom `owner_id`, sedangkan tabel `products` pada database yang dituju **tidak memiliki kolom tersebut** |
| Penyebab akar | `VITE_API_BASE_URL` dan key masih mengarah ke Supabase milik asisten. Skema di sana tidak bisa diubah, sedangkan kode (`gunService.createGun`) kini mengirim `owner_id`, `status`, dan `images` |
| Faktor pemberat | Kode memiliki banyak *silent fallback* (`catch → success: true`, penyimpanan arsip ke `localStorage`, upload gambar jatuh ke *base64*). Kegagalan skema tersamarkan sehingga data tampak tersimpan padahal tidak |
| Kondisi `.env.example` | Masih berisi `https://modlima.fuadfakhruz.id` dan tidak memuat `VITE_SUPABASE_PUBLISHABLE_KEY` |

---

## 2. Kesenjangan Skema (kode vs database asisten vs target)

| Kebutuhan kode | Lokasi | Ada di DB asisten | Target di DB sendiri |
|----------------|--------|-------------------|----------------------|
| `products.owner_id` | `gunService.createGun` | Tidak | `UUID` |
| `products.status` (`draft`/`published`) | `getGuns`, `GunDetailPage` | Tidak | `TEXT` + `CHECK` |
| `products.deleted_at` (arsip) | `archiveGun`, `restoreGun`, `getArchivedGuns` | Tidak | `TIMESTAMPTZ` |
| `products.images` (multi gambar) | `normalizeProduct`, `createGun`, `GunDetail` | Tidak | `JSONB` berisi array URL |
| `reviews.thumbs_up`, `thumbs_down` | `reviewService` | Tidak | `INTEGER` dijaga trigger |
| Vote per pengguna | belum ada (counter hanya bertambah tanpa batas per user) | Tidak | Tabel `review_votes` |
| `reviews.updated_at` | edit review | Tidak | `TIMESTAMPTZ` |
| Bucket `product-images` | `uploadService` | Tidak dapat dipastikan | Dibuat *public* via SQL |
| Policy storage untuk `anon` | upload tanpa *Auth* | Hanya `authenticated` pada `database.md` | Ditambahkan |

---

## 3. Keputusan

| Topik | Keputusan | Alasan |
|-------|-----------|--------|
| Nama kolom arsip | **`deleted_at`** (bukan `archived_at` pada `PLAN.md`) | Kode yang sudah ada memakai `deleted_at`. Perubahan nama di DB lebih murah daripada refactor |
| Multi gambar | Kolom **`products.images JSONB`** (array URL). `image_url` tetap menjadi *cover* (`images[0]`) | Kode sudah memakai pola ini. Tabel `product_images` dari `PLAN.md` digantikan demi kesederhanaan |
| Vote review | Tabel `review_votes` (satu vote per user per review) + **trigger** yang menjaga `thumbs_up`/`thumbs_down` | UI tetap membaca counter, sementara vote ganda dan spam tercegah |
| *Silent fallback* | **Dihapus**. Error ditampilkan apa adanya (toast) | Mencegah data tampak tersimpan padahal gagal |
| Backend lama (`/api/v1/*`) | Dihapus. Aplikasi hanya mendukung Supabase | Menghilangkan percabangan `IS_SUPABASE` |
| Kunci akses | Hanya *publishable/anon key* di frontend. **`service_role` tidak pernah dipakai di frontend maupun repo** | Key `service_role` melewati seluruh RLS |
| Cache lama | Wajib dibersihkan di browser setelah pindah (Bagian 6) | Cache API dan *Service Worker* dari DB lama dapat tersisa |

---

## 4. Task

### 4.1 Setup project Supabase (manual, dikerjakan di dashboard)

| No | Langkah | Hasil |
|----|---------|-------|
| 1 | Buka `supabase.com` → *New project*. Catat *Project URL* dan *Publishable key* (menu *Project Settings → API Keys*) | URL `https://<ref>.supabase.co` dan key |
| 2 | *SQL Editor* → jalankan **Bagian 5** secara utuh (satu kali) | Tabel, RLS, trigger, bucket, seed |
| 3 | *Table Editor* → pastikan `products` berisi 14 baris, kolom `owner_id`, `status`, `deleted_at`, `images` muncul | Skema sesuai |
| 4 | *Storage* → pastikan bucket `product-images` berstatus **Public** | Bucket aktif |
| 5 | Jika perintah terakhir pada SQL (`NOTIFY pgrst, 'reload schema'`) tidak berpengaruh, jalankan ulang secara terpisah | *Schema cache* PostgREST diperbarui |

### 4.2 Environment

| Lokasi | Tindakan |
|--------|----------|
| `.env` lokal (tidak di-*commit*) | `VITE_API_BASE_URL=https://<ref>.supabase.co` dan `VITE_SUPABASE_PUBLISHABLE_KEY=<key>` |
| `.env.example` | Ganti isi menjadi *placeholder* di atas, hapus referensi `modlima.fuadfakhruz.id` |
| Vercel → *Settings → Environment Variables* | Isi kedua variabel untuk *Production*, *Preview*, *Development* |
| Vercel | **Redeploy** (variabel `VITE_*` ditanam saat *build*) |
| Dev server | Restart `npm run dev` setelah `.env` diubah |

### 4.3 Perubahan kode

| File | Perubahan |
|------|-----------|
| `src/config/api.js` | Hapus `IS_SUPABASE`. Jika URL atau key kosong, tampilkan error konfigurasi yang jelas. Header `Authorization` hanya dikirim bila key berformat JWT (`eyJ…`), selain itu cukup `apikey` |
| `src/services/gunService.js` | Hapus seluruh cabang `/api/v1/recipes`, `getLocalArchivedIds`, dan *retry* tanpa kolom. Query publik memakai `deleted_at=is.null&status=eq.published`. `getArchivedGuns(ownerId)` memakai `deleted_at=not.is.null&owner_id=eq.<uuid>`. `createGun`/`updateGun` mengirim `images` sebagai array URL dan `image_url = images[0]` |
| `src/services/uploadService.js` | Hapus *fallback base64*. Unggah ke `product-images/products/<uuid>.<ext>` dengan header `cache-control: max-age=31536000`. Gagal berarti `throw` dengan pesan jelas. Tambah `removeImage(url)` untuk membersihkan objek storage saat gambar dihapus atau produk dihapus permanen |
| `src/services/reviewService.js` | Hapus *silent fallback*. Tambah `getReviews` dengan `select=*,review_votes(user_id,vote)` agar `myVote` dapat dihitung. `vote(reviewId, vote)` memakai `POST /rest/v1/review_votes?on_conflict=review_id,user_id` (`Prefer: resolution=merge-duplicates`), cabut vote memakai `DELETE`. Counter dibaca dari `thumbs_up`/`thumbs_down` |
| `src/services/favoriteService.js` | Hapus cabang API lama. Join `products!inner(*)` dengan filter `products.deleted_at=is.null` |
| `src/hooks/useReviews.js`, `GunDetail.jsx` | Ganti pemanggilan `thumbsUp(currentValue)` menjadi `vote(reviewId, ±1)`. Tombol aktif menandai `myVote`, tombol pada review sendiri dinonaktifkan |
| `src/pages/CreateGunPage.jsx`, `EditGunPage.jsx` | Seluruh error dari service ditampilkan ke pengguna. Tidak ada lagi gambar yang tersimpan sebagai `data:` URL |
| `src/data/guns.js` | Hapus bila tidak lagi dirujuk |

### 4.4 Pembersihan data dan cache setelah pindah

| Langkah | Tujuan |
|---------|--------|
| DevTools → *Application → Storage → Clear site data* (centang *Unregister service workers*) | Menghapus cache API dan SW dari DB lama |
| Di Vercel, buka URL produksi pada tab *incognito* untuk uji pertama | Menghindari cache lama |
| `localStorage` kunci `bore_barrel_user_id` boleh dipertahankan | UUID anonim tetap valid pada DB baru |
| Hapus kunci `gun_draft_*` dan `*archived*` di `localStorage` | Sisa mekanisme lama yang tidak dipakai lagi |

---

## 5. SQL Lengkap (jalankan di *SQL Editor* project baru)

```sql
-- =====================================================
-- 1. PRODUCTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.products (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    caliber TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    description TEXT,
    specs JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url TEXT,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    owner_id UUID,
    status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'published')),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_owner
    ON public.products (owner_id);
CREATE INDEX IF NOT EXISTS idx_products_visibility
    ON public.products (status, deleted_at, created_at DESC);

-- =====================================================
-- 2. REVIEWS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL
        REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    thumbs_up INTEGER NOT NULL DEFAULT 0,
    thumbs_down INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (product_id, user_id)
);

-- =====================================================
-- 3. REVIEW VOTES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.review_votes (
    review_id BIGINT NOT NULL
        REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id)
);

CREATE OR REPLACE FUNCTION public.refresh_review_vote_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rid BIGINT;
BEGIN
    rid := COALESCE(NEW.review_id, OLD.review_id);
    UPDATE public.reviews r
    SET thumbs_up = (
            SELECT COUNT(*) FROM public.review_votes v
            WHERE v.review_id = rid AND v.vote = 1
        ),
        thumbs_down = (
            SELECT COUNT(*) FROM public.review_votes v
            WHERE v.review_id = rid AND v.vote = -1
        )
    WHERE r.id = rid;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_votes_counts ON public.review_votes;
CREATE TRIGGER trg_review_votes_counts
AFTER INSERT OR UPDATE OR DELETE ON public.review_votes
FOR EACH ROW EXECUTE FUNCTION public.refresh_review_vote_counts();

-- =====================================================
-- 4. FAVORITES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.favorites (
    user_id UUID NOT NULL,
    product_id BIGINT NOT NULL
        REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, product_id)
);

-- =====================================================
-- 5. RLS DAN HAK AKSES (APP TANPA AUTH)
-- =====================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.products, public.reviews, public.review_votes, public.favorites
TO anon, authenticated;

GRANT USAGE, SELECT
ON SEQUENCE public.products_id_seq, public.reviews_id_seq
TO anon, authenticated;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['products', 'reviews', 'review_votes', 'favorites']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon all on %1$s" ON public.%1$s', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated all on %1$s" ON public.%1$s', t);
        EXECUTE format(
            'CREATE POLICY "Allow anon all on %1$s" ON public.%1$s FOR ALL TO anon USING (true) WITH CHECK (true)', t);
        EXECUTE format(
            'CREATE POLICY "Allow authenticated all on %1$s" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END
$$;

-- =====================================================
-- 6. STORAGE — BUCKET PUBLIC DAN POLICY
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon update product images" ON storage.objects;
DROP POLICY IF EXISTS "Anon delete product images" ON storage.objects;

CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Anon upload product images"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anon update product images"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anon delete product images"
ON storage.objects FOR DELETE TO anon, authenticated
USING (bucket_id = 'product-images');

-- =====================================================
-- 7. SEED (6 PRODUK ASLI + 8 TAMBAHAN UNTUK UJI LAZY LOAD)
--    owner_id sengaja NULL (data bawaan, hanya dapat dilihat).
--    File seed-01.svg s.d. seed-08.svg dibuat pada task 4.5.
-- =====================================================
INSERT INTO public.products
    (name, type, caliber, price, image_url, images, description, specs)
VALUES
('Glock 17', 'Pistol', '9mm', 599, '/guns/pistol.svg', '["/guns/pistol.svg"]',
 'The duty pistol everything else is measured against. Polymer frame, 17-round magazine, striker-fired trigger. Safe, boring, and it always goes bang.', '[]'),
('AK-47', 'Rifle', '7.62mm', 899, '/guns/rifle.svg', '["/guns/rifle.svg"]',
 'Gas-operated, loose tolerances, and famously indifferent to mud. Seven decades of service and still the benchmark for a rifle that will not quit.', '[]'),
('Remington 870', 'Shotgun', '12 Gauge', 449, '/guns/shotgun.svg', '["/guns/shotgun.svg"]',
 'Pump-action workhorse. Five shells in the tube, a receiver that has taken more abuse than most trucks, and a sound that ends arguments.', '[]'),
('AR-15', 'Rifle', '5.56mm', 799, '/guns/rifle.svg', '["/guns/rifle.svg"]',
 'Light-recoiling, endlessly modular, and accurate well past the range most shooters can hold. The platform you can rebuild with one tool.', '[]'),
('Desert Eagle', 'Pistol', '.50 AE', 1599, '/guns/pistol.svg', '["/guns/pistol.svg"]',
 'Gas-operated hand cannon. Three and a half pounds of chromed steel that fires a round most pistols would refuse. Subtle it is not.', '[]'),
('Mossberg 500', 'Shotgun', '12 Gauge', 399, '/guns/shotgun.svg', '["/guns/shotgun.svg"]',
 'The other pump gun. Twin action bars, a simple safety on the tang, and a price that leaves money for ammunition.', '[]'),
('Beretta 92FS', 'Pistol', '9mm', 649, '/guns/seed-01.svg', '["/guns/seed-01.svg"]',
 'Open-slide Italian classic with a smooth double-action trigger and a long service record.', '[]'),
('Colt 1911', 'Pistol', '.45 ACP', 1099, '/guns/seed-02.svg', '["/guns/seed-02.svg"]',
 'Single-action steel frame that defined the modern service pistol. Crisp trigger, heavy and deliberate.', '[]'),
('SIG P226', 'Pistol', '9mm', 1049, '/guns/seed-03.svg', '["/guns/seed-03.svg"]',
 'Full-size duty pistol with a decocker and a reputation for reliability under hard use.', '[]'),
('Winchester Model 70', 'Rifle', '.308 Win', 1199, '/guns/seed-04.svg', '["/guns/seed-04.svg"]',
 'Controlled-feed bolt action known as the rifleman''s rifle. Smooth cycling and a crisp trigger.', '[]'),
('Ruger 10/22', 'Rifle', '.22 LR', 329, '/guns/seed-05.svg', '["/guns/seed-05.svg"]',
 'Light semi-auto rimfire with a rotary magazine. Cheap to shoot and endlessly customizable.', '[]'),
('Benelli M4', 'Shotgun', '12 Gauge', 1999, '/guns/seed-06.svg', '["/guns/seed-06.svg"]',
 'Gas-operated semi-auto tactical shotgun with a self-regulating piston system.', '[]'),
('Springfield M1A', 'Rifle', '.308 Win', 1799, '/guns/seed-07.svg', '["/guns/seed-07.svg"]',
 'Civilian descendant of the M14. Heavy, accurate, and built like a battle rifle should be.', '[]'),
('Mossberg 590A1', 'Shotgun', '12 Gauge', 599, '/guns/seed-08.svg', '["/guns/seed-08.svg"]',
 'Heavy-wall barrel and metal trigger guard for sustained use. A pump gun built for abuse.', '[]');

-- =====================================================
-- 8. MUAT ULANG SCHEMA CACHE POSTGREST
-- =====================================================
NOTIFY pgrst, 'reload schema';
```

> Skrip bersifat *fresh install*. Jika dijalankan ulang pada project yang sama, bagian seed akan menggandakan baris. Hapus bagian 7 untuk eksekusi kedua.

### 4.5 Aset seed untuk uji *lazy load*

| Langkah | Detail |
|---------|--------|
| Buat 8 file SVG berbeda (`public/guns/seed-01.svg` … `seed-08.svg`) dengan warna latar dan label berbeda dari `pistol.svg` | Agar *Network* menampilkan 14 request gambar berbeda, bukan 3 yang berulang |
| Pastikan `vite.config.js` mengecualikan `guns/**` dari *precache* | Agar kolom *Size* menunjukkan `(disk cache)` dan bukan `(ServiceWorker)` |
| Pastikan `vercel.json` memberi `Cache-Control: public, max-age=31536000, immutable` untuk `/guns/*` dan `/assets/*` | Sudah ada pada *commit* terakhir |

---

## 6. Verifikasi

| No | Uji | Hasil yang diharapkan |
|----|-----|-----------------------|
| 1 | `curl "$URL/rest/v1/products?select=id,name,owner_id,status,deleted_at,images&limit=1" -H "apikey: $KEY"` | JSON berisi seluruh kolom, tanpa error |
| 2 | Buat katalog baru dengan 2–3 gambar | Tidak ada error `owner_id`. Baris baru memiliki `owner_id` UUID dan `images` berisi URL `…/storage/v1/object/public/product-images/…` |
| 3 | Buka URL gambar hasil upload di tab baru | Gambar tampil. Header respons memuat `cache-control: max-age=31536000` |
| 4 | Simpan sebagai draft | Baris `status = 'draft'`, tidak tampil di katalog publik, tampil di Profile → Drafts |
| 5 | Arsipkan → cek Archive → *Restore* → arsipkan → *Delete permanently* | `deleted_at` terisi, kosong kembali, lalu baris dan objek storage hilang |
| 6 | Buat review → edit → hapus. Dari *incognito* (UUID berbeda) like lalu ganti ke dislike, lalu cabut | `review_votes` berubah, `thumbs_up`/`thumbs_down` ikut berubah lewat trigger |
| 7 | Buat review kedua dari UUID yang sama pada produk yang sama | Ditolak dengan pesan jelas (constraint `UNIQUE`) |
| 8 | Reload dua kali pada tab *Network* filter `Img` | Kolom *Size* menunjukkan `(disk cache)` |
| 9 | Buka link share di *incognito* | Detail katalog terbuka langsung |
| 10 | `npm run lint`, `npm run build`, deploy Vercel | Bersih, aplikasi berjalan di URL produksi |

---

## 7. Risiko dan Catatan

| Risiko | Penanganan |
|--------|------------|
| Policy RLS `USING (true)` membuat siapa pun dengan *publishable key* dapat mengubah atau menghapus data | Sesuai skema tugas (tanpa *Auth*). Kepemilikan hanya divalidasi di klien. Dicatat pada bagian analisis laporan |
| *Publishable key* terlihat di *bundle* frontend | Memang dirancang publik. Yang tidak boleh bocor adalah `service_role`/*secret key* |
| Project Supabase gratis dapat *paused* setelah tidak aktif | Buka dashboard sebelum demo atau penilaian dan pastikan status *Active* |
| Data di database asisten tidak ikut berpindah | Tidak dibutuhkan. Seed pada Bagian 5 menggantikan |
| Error DB tidak lagi tersamarkan setelah *silent fallback* dihapus | Perilaku yang diinginkan. Setiap kegagalan tampil sebagai *toast* |

---

## 8. Urutan Eksekusi

| Fase | Tindakan | Pelaksana |
|------|----------|-----------|
| 1 | Buat project Supabase dan jalankan SQL Bagian 5 | Pemilik project |
| 2 | Isi `.env` lokal, restart dev server, bersihkan cache browser | Pemilik project |
| 3 | Terapkan perubahan kode Bagian 4.3 dan aset Bagian 4.5 | Implementasi |
| 4 | Jalankan verifikasi 1–9 secara lokal | Implementasi + pemilik project |
| 5 | Isi *env var* Vercel, *redeploy*, jalankan verifikasi 10 | Pemilik project |
| 6 | Lanjutkan sisa poin pada `PLAN.md` sesuai urutan | Implementasi |
