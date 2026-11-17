-- Untuk proyek BARU (versi lengkap terbaru). Jalankan di Supabase: SQL Editor -> New query -> Run
create table public.laporan_ht (
  id bigint generated always as identity primary key,
  pelapor text not null,
  nama_tempat text not null,
  alamat text not null,
  latitude double precision,
  longitude double precision,
  foto_url text not null,
  foto_urls text[] not null default '{}',
  keterangan text,
  created_at timestamptz not null default now()
);

-- RLS aktif tanpa policy: hanya server (secret key) yang bisa membaca/menulis tabel.
alter table public.laporan_ht enable row level security;

-- Bucket foto (publik agar foto bisa tampil lewat link)
insert into storage.buckets (id, name, public) values ('bukti-foto', 'bukti-foto', true);
