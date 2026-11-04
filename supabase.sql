-- Jalankan di Supabase: SQL Editor -> New query -> Run
create table public.laporan_ht (
  id bigint generated always as identity primary key,
  pelapor text not null,
  nama_tempat text not null,
  alamat text not null,
  latitude double precision,
  longitude double precision,
  foto_url text not null,
  created_at timestamptz not null default now()
);

alter table public.laporan_ht enable row level security;
create policy "siapa saja boleh melihat" on public.laporan_ht for select using (true);
create policy "siapa saja boleh melapor" on public.laporan_ht for insert with check (true);

-- Bucket foto (publik agar foto bisa tampil)
insert into storage.buckets (id, name, public) values ('bukti-foto', 'bukti-foto', true);
create policy "siapa saja boleh melihat foto" on storage.objects for select using (bucket_id = 'bukti-foto');
create policy "siapa saja boleh unggah foto" on storage.objects for insert with check (bucket_id = 'bukti-foto');
