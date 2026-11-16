import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const NAMA_COOKIE = 'sesi_ht';
export const DURASI_DETIK = 60 * 60 * 8;

const AKUN = [
  { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'balmon', role: 'admin' },
  { username: process.env.PEGAWAI_USERNAME || 'balmon', password: process.env.PEGAWAI_PASSWORD || 'balmon', role: 'pegawai' },
];

function rahasia() {
  const k = process.env.SUPABASE_SECRET_KEY;
  if (!k) throw new Error('SUPABASE_SECRET_KEY belum diisi di Vercel.');
  return 'sesi-ht:' + k;
}

const tanda = (isi) => crypto.createHmac('sha256', rahasia()).update(isi).digest('base64url');
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sama = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));

export function cekLogin(username, password) {
  let hasil = null;
  for (const a of AKUN) {
    if (sama(username, a.username) && sama(password, a.password)) hasil = a.role;
  }
  return hasil;
}

export function buatSesi(role) {
  const isi = Buffer.from(JSON.stringify({ role, exp: Date.now() + DURASI_DETIK * 1000 })).toString('base64url');
  return isi + '.' + tanda(isi);
}

export function bacaSesi() {
  try {
    const token = cookies().get(NAMA_COOKIE)?.value;
    if (!token) return null;
    const [isi, ttd] = token.split('.');
    if (!isi || !ttd) return null;
    const a = Buffer.from(ttd);
    const b = Buffer.from(tanda(isi));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const d = JSON.parse(Buffer.from(isi, 'base64url').toString());
    if (!d.exp || d.exp < Date.now()) return null;
    if (d.role !== 'admin' && d.role !== 'pegawai') return null;
    return { role: d.role };
  } catch {
    return null;
  }
}

export const opsiCookie = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge,
});

export function wajib(role) {
  const s = bacaSesi();
  if (!s) return { error: NextResponse.json({ pesan: 'Silakan masuk terlebih dahulu.' }, { status: 401 }) };
  if (role && s.role !== role) return { error: NextResponse.json({ pesan: 'Akses ditolak.' }, { status: 403 }) };
  return { sesi: s };
}

export function dbAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
