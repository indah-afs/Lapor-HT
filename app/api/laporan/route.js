import { NextResponse } from 'next/server';
import { wajib, dbAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

const POLA_FOTO = /^\d+-[a-f0-9]{8}\.(jpg|png|webp|heic|heif)$/;
const MAKS_FOTO = 10;

const fotoList = (r) => (r.foto_urls && r.foto_urls.length ? r.foto_urls : r.foto_url ? [r.foto_url] : []);

// Ambil nama file di bucket dari URL publik foto
const jalurFoto = (urls) =>
  urls
    .map((u) => decodeURIComponent(String(u).split('/bukti-foto/').pop().split('?')[0]))
    .filter((p) => /^[\w.\-]+$/.test(p));

// Memeriksa isian teks dan koordinat (dipakai saat membuat dan mengedit laporan)
function periksa(b) {
  const teks = (v, maks) => String(v ?? '').trim().slice(0, maks);
  const pelapor = teks(b.pelapor, 100);
  const nama_tempat = teks(b.nama_tempat, 200);
  const alamat = teks(b.alamat, 500);
  const keterangan = teks(b.keterangan, 2000);
  if (!pelapor || !nama_tempat || !alamat) {
    return { pesan: 'Nama pelapor, nama tempat, dan alamat wajib diisi.' };
  }

  const angka = (v) => {
    if (v === undefined || v === null) return null;
    const t = String(v).trim().replace(/[\u2212\u2013]/g, '-').replace(',', '.');
    return t === '' ? null : Number(t);
  };
  const lat = angka(b.latitude);
  const lng = angka(b.longitude);
  if ((lat === null) !== (lng === null)) return { pesan: 'Isi latitude dan longitude keduanya, atau kosongkan keduanya.' };
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return { pesan: 'Latitude harus angka antara -90 dan 90.' };
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) return { pesan: 'Longitude harus angka antara -180 dan 180.' };

  return { nilai: { pelapor, nama_tempat, alamat, latitude: lat, longitude: lng, keterangan: keterangan || null } };
}

const idDari = (req) => {
  const id = Number(new URL(req.url).searchParams.get('id'));
  return Number.isInteger(id) && id > 0 ? id : null;
};

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

  const salah = (pesan) => NextResponse.json({ pesan }, { status: 400 });
  const hasil = periksa(b);
  if (hasil.pesan) return salah(hasil.pesan);

  const paths = Array.isArray(b.foto_paths) ? b.foto_paths.map(String) : [];
  if (paths.length > MAKS_FOTO || !paths.every((p) => POLA_FOTO.test(p))) {
    return salah('Foto bukti tidak valid.');
  }

  const db = dbAdmin();
  const urls = paths.map((p) => db.storage.from('bukti-foto').getPublicUrl(p).data.publicUrl);
  const { error: e } = await db.from('laporan_ht').insert({
    ...hasil.nilai, foto_url: urls[0] || null, foto_urls: urls,
  });
  if (e) return NextResponse.json({ pesan: e.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  const { error } = wajib('admin');
  if (error) return error;

  const id = idDari(req);
  if (!id) return NextResponse.json({ pesan: 'ID laporan tidak valid.' }, { status: 400 });

  let b = {};
  try { b = await req.json(); } catch {}
  const salah = (pesan) => NextResponse.json({ pesan }, { status: 400 });

  const hasil = periksa(b);
  if (hasil.pesan) return salah(hasil.pesan);

  const db = dbAdmin();
  const { data: lama, error: e0 } = await db
    .from('laporan_ht').select('foto_url, foto_urls').eq('id', id).maybeSingle();
  if (e0) return NextResponse.json({ pesan: e0.message }, { status: 500 });
  if (!lama) return NextResponse.json({ pesan: 'Laporan tidak ditemukan.' }, { status: 404 });

  // Foto yang sudah ada, foto yang dihapus, dan foto baru
  const sekarang = fotoList(lama);
  const hapusUrl = Array.isArray(b.foto_hapus) ? b.foto_hapus.map(String) : [];
  if (!hapusUrl.every((u) => sekarang.includes(u))) return salah('Foto yang akan dihapus tidak ditemukan pada laporan ini.');

  const tambahPath = Array.isArray(b.foto_tambah) ? b.foto_tambah.map(String) : [];
  if (!tambahPath.every((p) => POLA_FOTO.test(p))) return salah('Foto baru tidak valid.');
  const tambahUrl = tambahPath.map((p) => db.storage.from('bukti-foto').getPublicUrl(p).data.publicUrl);

  const akhir = [...sekarang.filter((u) => !hapusUrl.includes(u)), ...tambahUrl];
  if (akhir.length > MAKS_FOTO) return salah(`Maksimal ${MAKS_FOTO} foto per laporan.`);

  const { data, error: e } = await db
    .from('laporan_ht')
    .update({ ...hasil.nilai, foto_url: akhir[0] || null, foto_urls: akhir })
    .eq('id', id).select().maybeSingle();
  if (e) return NextResponse.json({ pesan: e.message }, { status: 500 });
  if (!data) return NextResponse.json({ pesan: 'Laporan tidak ditemukan.' }, { status: 404 });

  // Hapus file foto yang dibuang (tidak menggagalkan penyimpanan bila gagal)
  const paths = jalurFoto(hapusUrl);
  if (paths.length) {
    try { await db.storage.from('bukti-foto').remove(paths); } catch {}
  }
  return NextResponse.json({ data });
}

export async function DELETE(req) {
  const { error } = wajib('admin');
  if (error) return error;

  const id = idDari(req);
  if (!id) return NextResponse.json({ pesan: 'ID laporan tidak valid.' }, { status: 400 });

  const db = dbAdmin();
  const { data: baris, error: e1 } = await db
    .from('laporan_ht').select('foto_url, foto_urls').eq('id', id).maybeSingle();
  if (e1) return NextResponse.json({ pesan: e1.message }, { status: 500 });
  if (!baris) return NextResponse.json({ pesan: 'Laporan tidak ditemukan.' }, { status: 404 });

  const { error: e2 } = await db.from('laporan_ht').delete().eq('id', id);
  if (e2) return NextResponse.json({ pesan: e2.message }, { status: 500 });

  // Hapus juga file fotonya (tidak menggagalkan penghapusan laporan bila gagal)
  const paths = jalurFoto(fotoList(baris));
  if (paths.length) {
    try { await db.storage.from('bukti-foto').remove(paths); } catch {}
  }
  return NextResponse.json({ ok: true });
}
