import { NextResponse } from 'next/server';
import { bacaSesi } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = bacaSesi();
  return NextResponse.json({ role: s ? s.role : null });
}
