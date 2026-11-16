import { NextResponse } from 'next/server';
import { cekLogin, buatSesi, NAMA_COOKIE, DURASI_DETIK, opsiCookie } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    let b = {};
    try { b = await req.json(); } catch {}
    const role = cekLogin(String(b.username || ''), String(b.password || ''));
    if (!role) {
      await new Promise((r) => setTimeout(r, 700));
      return NextResponse.json({ pesan: 'Username atau password salah.' }, { status: 401 });
    }
    const res = NextResponse.json({ role });
    res.cookies.set(NAMA_COOKIE, buatSesi(role), opsiCookie(DURASI_DETIK));
    return res;
  } catch (e) {
    return NextResponse.json({ pesan: e.message }, { status: 500 });
  }
}
