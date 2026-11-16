'use client';
import './foto.css';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LOGO } from '../lib/logo';

const JSON_HEADER = { 'Content-Type': 'application/json' };
const awal = { pelapor: '', nama_tempat: '', alamat: '', latitude: '', longitude: '' };
const FORMAT_FOTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
const MAKS_FOTO = 10;

async function panggil(url, opsi) {
  const r = await fetch(url, opsi);
  let d = {};
  try { d = await r.json(); } catch {}
  if (!r.ok) {
    const e = new Error(d.pesan || 'Terjadi kesalahan.');
    e.status = r.status;
    throw e;
  }
  return d;
}

function Masuk({ onMasuk }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [sedang, setSedang] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    setSedang(true);
    setErr('');
    try {
      const d = await panggil('/api/login', {
        method: 'POST', headers: JSON_HEADER,
        body: JSON.stringify({ username: u.trim(), password: p }),
      });
      onMasuk({ role: d.role });
    } catch (x) {
      setErr(x.message);
    } finally {
      setSedang(false);
    }
  };

  return (
    <>
      <h1>Masuk</h1>
      <p className="sub">Masuk untuk melaporkan lokasi penggunaan HT.</p>
      <form onSubmit={kirim}>
        <label>Username
          <input required value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="none" />
        </label>
        <label>Password
          <input required type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
        </label>
        <button type="submit" disabled={sedang}>{sedang ? 'Memeriksa...' : 'Masuk'}</button>
        {err && <p className="status err" role="alert">{err}</p>}
      </form>
    </>
  );
}

function FormLapor({ onTidakSah }) {
  const [f, setF] = useState(awal);
  const [foto, setFoto] = useState([]);
  const [fotoKey, setFotoKey] = useState(0);
  const [pesan, setPesan] = useState({ teks: '', err: false });
  const [sedang, setSedang] = useState(false);
  const [terkirim, setTerkirim] = useState(false);

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

    if (foto.length === 0) return info('Foto bukti wajib diunggah.', true);
    if (foto.length > MAKS_FOTO) return info(`Maksimal ${MAKS_FOTO} foto per laporan.`, true);
    const exts = [];
    for (const x of foto) {
      const ext = FORMAT_FOTO[x.type];
      if (!ext) return info(`Format foto "${x.name}" tidak didukung. Gunakan JPG, PNG, WEBP, atau HEIC.`, true);
      if (x.size > 10 * 1024 * 1024) return info(`Foto "${x.name}" lebih dari 10 MB.`, true);
      exts.push(ext);
    }

    setSedang(true);
    info('Menyiapkan unggahan...');
    try {
      const u = await panggil('/api/upload-url', { method: 'POST', headers: JSON_HEADER, body: JSON.stringify({ exts }) });
      for (let i = 0; i < foto.length; i++) {
        info(`Mengunggah foto ${i + 1} dari ${foto.length}...`);
        const up = await supabase.storage.from('bukti-foto')
          .uploadToSignedUrl(u.berkas[i].path, u.berkas[i].token, foto[i], { contentType: foto[i].type });
        if (up.error) throw up.error;
      }
      info('Menyimpan laporan...');
      await panggil('/api/laporan', {
        method: 'POST', headers: JSON_HEADER,
        body: JSON.stringify({
          pelapor: f.pelapor, nama_tempat: f.nama_tempat, alamat: f.alamat,
          latitude: f.latitude, longitude: f.longitude,
          foto_paths: u.berkas.map((b) => b.path),
        }),
      });
      setF(awal); setFoto([]); setFotoKey((k) => k + 1);
      info('');
      setTerkirim(true);
    } catch (err) {
      if (err.status === 401) return onTidakSah();
      info('Gagal mengirim laporan: ' + (err.message || 'coba lagi.'), true);
    } finally {
      setSedang(false);
    }
  };

  return (
    <>
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
        <label>Foto bukti <small>wajib, bisa lebih dari satu (maksimal {MAKS_FOTO} foto, masing-masing 10 MB)</small>
          <input key={fotoKey} type="file" accept="image/*" multiple
            onChange={(e) => setFoto(Array.from(e.target.files || []))} />
        </label>
        {foto.length > 0 && <p className="pilihan-foto">{foto.length} foto dipilih</p>}
        <button type="submit" disabled={sedang}>{sedang ? 'Mengirim...' : 'Kirim laporan'}</button>
        {pesan.teks && <p className={'status' + (pesan.err ? ' err' : '')} role="status">{pesan.teks}</p>}
      </form>

      {terkirim && (
        <div className="tirai">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="judul-terima">
            <h2 id="judul-terima">Terima kasih atas laporannya!</h2>
            <p>Mari kita jaga kepatuhan spektrum frekuensi radio.</p>
            <button autoFocus onClick={() => { setTerkirim(false); window.scrollTo(0, 0); }}>Tutup</button>
          </div>
        </div>
      )}
    </>
  );
}

function Daftar({ onTidakSah }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    panggil('/api/laporan')
      .then((d) => setData(d.data || []))
      .catch((e) => (e.status === 401 || e.status === 403 ? onTidakSah() : setErr(e.message)));
  }, []);

  const fotoList = (r) => (r.foto_urls && r.foto_urls.length ? r.foto_urls : r.foto_url ? [r.foto_url] : []);

  return (
    <>
      <h1>Daftar laporan</h1>
      <p className="sub">Halaman ini hanya bisa dilihat admin.</p>
      <div className="ekspor">
        <a className="tombol" href="/api/ekspor?format=xlsx">Unduh Excel</a>
        <a className="tombol" href="/api/ekspor?format=csv">Unduh CSV</a>
        {data && <span>{data.length} laporan</span>}
      </div>
      {err && <p className="status err" role="alert">{err}</p>}
      {!data && !err && <p className="kosong">Memuat...</p>}
      {data && data.length === 0 && <p className="kosong">Belum ada laporan.</p>}
      {data && data.map((r) => {
        const fotos = fotoList(r);
        return (
          <article className="laporan" key={r.id}>
            <div className={'galeri' + (fotos.length === 1 ? ' satu' : '')}>
              {fotos.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Foto bukti ${i + 1} di ${r.nama_tempat}`} loading="lazy" />
                </a>
              ))}
            </div>
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
        );
      })}
    </>
  );
}

export default function Home() {
  const [sesi, setSesi] = useState(undefined);
  const [tab, setTab] = useState('lapor');
  const [buka, setBuka] = useState(false);

  useEffect(() => {
    panggil('/api/me')
      .then((d) => setSesi(d.role ? { role: d.role } : null))
      .catch(() => setSesi(null));
  }, []);

  const pilih = (t) => { setTab(t); setBuka(false); };
  const habis = () => { setSesi(null); setTab('lapor'); setBuka(false); };
  const keluar = async () => {
    try { await panggil('/api/logout', { method: 'POST' }); } catch {}
    habis();
  };

  return (
    <>
      <header className="atas">
        <div className="atas-isi">
          <div className="merek">
            <img src={LOGO} alt="Logo Balmon Makassar" />
            <p>Balmon SFRID Kelas I Makassar</p>
          </div>
          {sesi && (
            <div className="menu">
              <button type="button" className="sekunder" aria-expanded={buka} aria-haspopup="true" onClick={() => setBuka(!buka)}>Menu</button>
              {buka && (
                <div className="menu-isi" role="menu">
                  <p className="menu-info">Masuk sebagai {sesi.role}</p>
                  <button type="button" role="menuitem" onClick={() => pilih('lapor')}>Lapor HT</button>
                  {sesi.role === 'admin' && (
                    <button type="button" role="menuitem" onClick={() => pilih('daftar')}>Daftar laporan</button>
                  )}
                  <button type="button" role="menuitem" className="keluar" onClick={keluar}>Keluar</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <main>
        {sesi === undefined && <p className="kosong">Memuat...</p>}
        {sesi === null && <Masuk onMasuk={setSesi} />}
        {sesi && (sesi.role === 'admin' && tab === 'daftar'
          ? <Daftar onTidakSah={habis} />
          : <FormLapor onTidakSah={habis} />)}
      </main>
    </>
  );
}
