-- Untuk proyek yang SUDAH berjalan dengan versi lama. Jalankan per langkah.

-- Langkah 1 (jalankan sebelum mengubah kode): kolom untuk banyak foto
alter table public.laporan_ht add column if not exists foto_urls text[] not null default '{}';

-- Langkah 2 (jalankan paling akhir, setelah situs baru berhasil deploy): tutup akses publik langsung
drop policy if exists "siapa saja boleh melihat" on public.laporan_ht;
drop policy if exists "siapa saja boleh melapor" on public.laporan_ht;
drop policy if exists "siapa saja boleh melihat foto" on storage.objects;
drop policy if exists "siapa saja boleh unggah foto" on storage.objects;

-- Langkah 3 (jalankan SEBELUM mengunggah versi 1.5): kolom keterangan tambahan
alter table public.laporan_ht add column if not exists keterangan text;

-- Langkah 4 (jalankan SEBELUM mengunggah versi 1.7): foto tidak lagi wajib
alter table public.laporan_ht alter column foto_url drop not null;
