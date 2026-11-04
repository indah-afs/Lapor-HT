'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const awal = { pelapor: '', nama_tempat: '', alamat: '', latitude: '', longitude: '' };

export default function Home() {
  const [f, setF] = useState(awal);
  const [foto, setFoto] = useState(null);
  const [pesan, setPesan] = useState({ teks: '', err: false });
  const [kirimSedang, setKirimSedang] = useState(false);
  const [daftar, setDaftar] = useState([]);
  const [fotoKey, setFotoKey] = useState(0);

  const muat = async () => {
    const { data } = await supabase
      .from('laporan_ht').select('*')
      .order('created_at', { ascending: false }).limit(50);
    setDaftar(data || []);
  };
  useEffect(() => { muat(); }, []);

  const isi = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const info = (teks, err = false) => setPesan({ teks, err });

  const ambilLokasi = () => {
    if (!navigator.geolocation) return info('Browser tidak mendukung lokasi.', true);
    info('Mengambil lokasi...');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setF((x) => ({ ...x, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }));
        info('Koordinat terisi dari lokasi Anda.');
      },
      () => info('Lokasi tidak bisa diambil. Izinkan akses lokasi atau isi koordinat manual.', true)
    );
  };

  const kirim = async (e) => {
    e.preventDefault();
    const lat = f.latitude.trim() === '' ? null : Number(f.latitude);
    const lng = f.longitude.trim() === '' ? null : Number(f.longitude);
    if ((lat === null) !== (lng === null)) return info('Isi latitude dan longitude keduanya, atau kosongkan keduanya.', true);
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) return info('Latitude harus angka antara -90 dan 90.', true);
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) return info('Longitude harus angka antara -180 dan 180.', true);
    if (!foto) return info('Foto bukti wajib diunggah.', true);
    if (!foto.type.startsWith('image/')) return info('File harus berupa gambar.', true);
    if (foto.size > 5 * 1024 * 1024) return info('Ukuran foto maksimal 5 MB.', true);

    setKirimSedang(true);
    info('Mengirim laporan...');
    try {
      const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from('bukti-foto').upload(path, foto, { contentType: foto.type });
      if (up.error) throw up.error;
      const { data: u } = supabase.storage.from('bukti-foto').getPublicUrl(path);
      const { error } = await supabase.from('laporan_ht').insert({
        pelapor: f.pelapor.trim(),
        nama_tempat: f.nama_tempat.trim(),
        alamat: f.alamat.trim(),
        latitude: lat,
        longitude: lng,
        foto_url: u.publicUrl,
      });
      if (error) throw error;
      setF(awal); setFoto(null); setFotoKey((k) => k + 1);
      info('Laporan terkirim. Terima kasih.');
      muat();
    } catch (err) {
      info('Gagal mengirim laporan: ' + (err.message || 'coba lagi.'), true);
    } finally {
      setKirimSedang(false);
    }
  };

  return (
    <main>
      <h1>Laporan lokasi penggunaan HT</h1>
      <p className="sub">Isi form di bawah untuk melaporkan di mana HT digunakan.</p>

      <form onSubmit={kirim}>
        <label>Nama pelapor
          <input required value={f.pelapor} onChange={isi('pelapor')} autoComplete="name" />
        </label>
        <label>Nama tempat
          <input required value={f.nama_tempat} onChange={isi('nama_tempat')} />
        </label>
        <label>Lokasi / alamat
          <textarea required rows={3} value={f.alamat} onChange={isi('alamat')} />
        </label>
        <div>
          <div className="koordinat">
            <label>Latitude <small>opsional</small>
              <input inputMode="decimal" value={f.latitude} onChange={isi('latitude')} placeholder="-6.200000" />
            </label>
            <label>Longitude <small>opsional</small>
              <input inputMode="decimal" value={f.longitude} onChange={isi('longitude')} placeholder="106.816666" />
            </label>
          </div>
          <p style={{ margin: '10px 0 0' }}>
            <button type="button" className="sekunder" onClick={ambilLokasi}>Ambil lokasi saya</button>
          </p>
        </div>
        <label>Foto bukti <small>wajib, maksimal 5 MB</small>
          <input key={fotoKey} type="file" accept="image/*" onChange={(e) => setFoto(e.target.files[0] || null)} />
        </label>
        <button type="submit" disabled={kirimSedang}>{kirimSedang ? 'Mengirim...' : 'Kirim laporan'}</button>
        {pesan.teks && <p className={'status' + (pesan.err ? ' err' : '')} role="status">{pesan.teks}</p>}
      </form>

      <h2>Laporan masuk</h2>
      {daftar.length === 0 && <p className="kosong">Belum ada laporan. Laporan pertama akan muncul di sini.</p>}
      {daftar.map((r) => (
        <article className="laporan" key={r.id}>
          <img src={r.foto_url} alt={'Foto bukti di ' + r.nama_tempat} loading="lazy" />
          <div>
            <h3>{r.nama_tempat}</h3>
            <p>{r.alamat}</p>
            {r.latitude !== null && r.longitude !== null && (
              <p><a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer">
                Buka di Google Maps</a> ({r.latitude}, {r.longitude})</p>
            )}
            <p>Dilaporkan oleh {r.pelapor} pada {new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
        </article>
      ))}
    </main>
  );
}
