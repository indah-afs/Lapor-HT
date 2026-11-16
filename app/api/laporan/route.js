import { NextResponse } from 'next/server';
import { wajib, dbAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = wajib('admin');
  if (error) return error;
  const { data, error: e } = await dbAdmin()
    .from('laporan_ht').select('*')
    .order('created_at', { ascending: false }).limit(500);
  if (e) return NextResponse.json({ pesan: e.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req) {
  const { error } = wajib();
  if (error) return error;
  let b = {};
  try { b = await req.json(); } catch {}

  const teks = (v, maks) => String(v ?? '').trim().slice(0, maks);
  const salah = (pesan) => NextResponse.json({ pesan }, { status: 400 });

  const pelapor = teks(b.pelapor, 100);
  const nama_tempat = teks(b.nama_tempat, 200);
  const alamat = teks(b.alamat, 500);
  if (!pelapor || !nama_tempat || !alamat) return salah('Nama pelapor, nama tempat, dan alamat wajib diisi.');

  const angka = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : Number(v));
  const lat = angka(b.latitude);
  const lng = angka(b.longitude);
  if ((lat === null) !== (lng === null)) return salah('Isi latitude dan longitude keduanya, atau kosongkan keduanya.');
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return salah('Latitude harus angka antara -90 dan 90.');
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) return salah('Longitude harus angka antara -180 dan 180.');

  const paths = Array.isArray(b.foto_paths) ? b.foto_paths.map(String) : [];
  const pola = /^\d+-[a-f0-9]{8}\.(jpg|png|webp|heic|heif)$/;
  if (paths.length < 1 || paths.length > 10 || !paths.every((p) => pola.test(p))) {
    return salah('Foto bukti tidak valid.');
  }

  const db = dbAdmin();
  const urls = paths.map((p) => db.storage.from('bukti-foto').getPublicUrl(p).data.publicUrl);
  const { error: e } = await db.from('laporan_ht').insert({
    pelapor, nama_tempat, alamat, latitude: lat, longitude: lng,
    foto_url: urls[0], foto_urls: urls,
  });
  if (e) return NextResponse.json({ pesan: e.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
