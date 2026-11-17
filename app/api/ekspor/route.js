import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { wajib, dbAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { error } = wajib('admin');
  if (error) return error;

  const format = new URL(req.url).searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const { data, error: e } = await dbAdmin()
    .from('laporan_ht').select('*').order('created_at', { ascending: false });
  if (e) return NextResponse.json({ pesan: e.message }, { status: 500 });

  const waktu = (t) => new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' });
  const fotoList = (r) => (r.foto_urls && r.foto_urls.length ? r.foto_urls : r.foto_url ? [r.foto_url] : []);
  const kolom = ['No', 'Waktu (WITA)', 'Pelapor', 'Nama Tempat', 'Alamat', 'Latitude', 'Longitude', 'Link Peta', 'Keterangan', 'Jumlah Foto', 'Link Foto'];
  const baris = data.map((r, i) => [
    i + 1,
    waktu(r.created_at),
    r.pelapor,
    r.nama_tempat,
    r.alamat,
    r.latitude ?? '',
    r.longitude ?? '',
    r.latitude != null && r.longitude != null ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}` : '',
    r.keterangan ?? '',
    fotoList(r).length,
    fotoList(r).join('\n'),
  ]);
  const tanggal = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' });
  const nama = `laporan-ht-${tanggal}`;

  if (format === 'csv') {
    const aman = (v) => {
      let s = String(v ?? '');
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = '\uFEFF' + [kolom, ...baris].map((b) => b.map(aman).join(',')).join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nama}.csv"`,
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laporan HT');
  ws.addRow(kolom);
  baris.forEach((b) => ws.addRow(b));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  [5, 20, 22, 28, 40, 12, 12, 34, 40, 12, 50].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.eachRow((row) => {
    [5, 9, 11].forEach((n) => { row.getCell(n).alignment = { wrapText: true, vertical: 'top' }; });
  });
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nama}.xlsx"`,
    },
  });
}
