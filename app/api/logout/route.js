import { NextResponse } from 'next/server';
import { NAMA_COOKIE, opsiCookie } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NAMA_COOKIE, '', opsiCookie(0));
  return res;
}
