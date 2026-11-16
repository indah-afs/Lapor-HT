import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { wajib, dbAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { error } = wajib();
  if (error) return error;
  let b = {};
  try { b = await req.json(); } catch {}

  const exts = Array.isArray(b.exts) ? b.exts.map((x) => String(x).toLowerCase()) : [];
  if (exts.length < 1 || exts.length > 10) {
    return NextResponse.json({ pesan: 'Jumlah foto harus 1 sampai 10.' }, { status: 400 });
  }
  if (!exts.every((x) => ['jpg', 'png', 'webp', 'heic', 'heif'].includes(x))) {
    return NextResponse.json({ pesan: 'Format foto harus JPG, PNG, WEBP, atau HEIC.' }, { status: 400 });
  }

  const db = dbAdmin();
  const berkas = [];
  for (const ext of exts) {
    const path = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const { data, error: e } = await db.storage.from('bukti-foto').createSignedUploadUrl(path);
    if (e) return NextResponse.json({ pesan: e.message }, { status: 500 });
    berkas.push({ path, token: data.token });
  }
  return NextResponse.json({ berkas });
}
