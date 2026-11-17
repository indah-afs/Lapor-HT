'use client';
import './foto.css';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LOGO } from '../lib/logo';

const JSON_HEADER = { 'Content-Type': 'application/json' };
const awal = { pelapor: '', nama_tempat: '', alamat: '', latitude: '', longitude: '', keterangan: '' };
const FORMAT_FOTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
const MAKS_FOTO = 10;

function bacaKoordinat(latTeks, lngTeks) {
  const angka = (s) => {
    const t = String(s ?? '').trim().replace(/[\u2212\u2013]/g, '-').replace(',', '.');
    return t === '' ? null : Number(t);
  };
  const lat = angka(latTeks);
  const lng = angka(lngTeks);
  if ((lat === null) !== (lng === null)) return { pesan: 'Isi latitude dan longitude keduanya, atau kosongkan keduanya.' };
  if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) return { pesan: 'Latitude harus angka antara -90 dan 90.' };
  if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) return { pesan: 'Longitude harus angka antara -180 dan 180.' };
  return { lat, lng };
}

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
    const k = bacaKoordinat(f.latitude, f.longitude);
    if (k.pesan) return info(k.pesan, true);
    const { lat, lng } = k;

    if (foto.length > MAKS_FOTO) return info(`Maksimal ${MAKS_FOTO} foto per laporan.`, true);
    const exts = [];
    for (const x of foto) {
      const ext = FORMAT_FOTO[x.type];
      if (!ext) return info(`Format foto "${x.name}" tidak didukung. Gunakan JPG, PNG, WEBP, atau HEIC.`, true);
      if (x.size > 10 * 1024 * 1024) return info(`Foto "${x.name}" lebih dari 10 MB.`, true);
      exts.push(ext);
    }

    setSedang(true);
    info(foto.length ? 'Menyiapkan unggahan...' : 'Menyimpan laporan...');
    try {
      const u = foto.length
        ? await panggil('/api/upload-url', { method: 'POST', headers: JSON_HEADER, body: JSON.stringify({ exts }) })
        : { berkas: [] };
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
          latitude: lat, longitude: lng, keterangan: f.keterangan,
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
            <label>Latitude
              <input inputMode="text" autoComplete="off" autoCapitalize="none" value={f.latitude} onChange={isi('latitude')} placeholder="-6.200000" />
            </label>
            <label>Longitude
              <input inputMode="text" autoComplete="off" autoCapitalize="none" value={f.longitude} onChange={isi('longitude')} placeholder="106.816666" />
            </label>
          </div>
          <p style={{ margin: '10px 0 0' }}>
            <button type="button" className="sekunder" onClick={ambilLokasi}>Ambil lokasi saya</button>
          </p>
        </div>
        <label>Keterangan tambahan <small>opsional. Contoh: HT milik pihak ketiga atau pemilik lokasi, atau hal lain yang sudah Anda identifikasi lebih awal.</small>
          <textarea rows={4} value={f.keterangan} onChange={isi('keterangan')} />
        </label>
        <label>Foto bukti <small>opsional, bisa lebih dari satu (maksimal {MAKS_FOTO} foto, masing-masing 10 MB)</small>
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
  const [target, setTarget] = useState(null);
  const [menghapus, setMenghapus] = useState(false);
  const [errHapus, setErrHapus] = useState('');
  const [edit, setEdit] = useState(null);
  const [ef, setEf] = useState(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [errEdit, setErrEdit] = useState('');
  const [infoEdit, setInfoEdit] = useState('');
  const [fotoLama, setFotoLama] = useState([]);
  const [fotoBaru, setFotoBaru] = useState([]);
  const [editKey, setEditKey] = useState(0);

  useEffect(() => {
    panggil('/api/laporan')
      .then((d) => setData(d.data || []))
      .catch((e) => (e.status === 401 || e.status === 403 ? onTidakSah() : setErr(e.message)));
  }, []);

  const fotoList = (r) => (r.foto_urls && r.foto_urls.length ? r.foto_urls : r.foto_url ? [r.foto_url] : []);

  const hapus = async () => {
    setMenghapus(true);
    setErrHapus('');
    try {
      await panggil('/api/laporan?id=' + target.id, { method: 'DELETE' });
      setData((d) => d.filter((x) => x.id !== target.id));
      setTarget(null);
    } catch (e) {
      if (e.status === 401 || e.status === 403) return onTidakSah();
      setErrHapus(e.message);
    } finally {
      setMenghapus(false);
    }
  };

  const bukaEdit = (r) => {
    setErrEdit('');
    setEf({
      pelapor: r.pelapor || '',
      nama_tempat: r.nama_tempat || '',
      alamat: r.alamat || '',
      latitude: r.latitude != null ? String(r.latitude) : '',
      longitude: r.longitude != null ? String(r.longitude) : '',
      keterangan: r.keterangan || '',
    });
    setInfoEdit('');
    setFotoLama(fotoList(r));
    setFotoBaru([]);
    setEditKey((k) => k + 1);
    setEdit(r);
  };
  const isiEdit = (k) => (e) => setEf((x) => ({ ...x, [k]: e.target.value }));

  const simpan = async (e) => {
    e.preventDefault();
    const k = bacaKoordinat(ef.latitude, ef.longitude);
    if (k.pesan) return setErrEdit(k.pesan);
    if (fotoLama.length + fotoBaru.length > MAKS_FOTO) return setErrEdit(`Maksimal ${MAKS_FOTO} foto per laporan.`);
    const exts = [];
    for (const x of fotoBaru) {
      const ext = FORMAT_FOTO[x.type];
      if (!ext) return setErrEdit(`Format foto "${x.name}" tidak didukung. Gunakan JPG, PNG, WEBP, atau HEIC.`);
      if (x.size > 10 * 1024 * 1024) return setErrEdit(`Foto "${x.name}" lebih dari 10 MB.`);
      exts.push(ext);
    }

    setMenyimpan(true);
    setErrEdit('');
    try {
      let paths = [];
      if (fotoBaru.length) {
        setInfoEdit('Menyiapkan unggahan...');
        const u = await panggil('/api/upload-url', { method: 'POST', headers: JSON_HEADER, body: JSON.stringify({ exts }) });
        for (let i = 0; i < fotoBaru.length; i++) {
          setInfoEdit(`Mengunggah foto ${i + 1} dari ${fotoBaru.length}...`);
          const up = await supabase.storage.from('bukti-foto')
            .uploadToSignedUrl(u.berkas[i].path, u.berkas[i].token, fotoBaru[i], { contentType: fotoBaru[i].type });
          if (up.error) throw up.error;
        }
        paths = u.berkas.map((x) => x.path);
      }
      setInfoEdit('Menyimpan perubahan...');
      const hapusUrl = fotoList(edit).filter((u) => !fotoLama.includes(u));
      const d = await panggil('/api/laporan?id=' + edit.id, {
        method: 'PATCH', headers: JSON_HEADER,
        body: JSON.stringify({ ...ef, latitude: k.lat, longitude: k.lng, foto_hapus: hapusUrl, foto_tambah: paths }),
      });
      setData((lst) => lst.map((x) => (x.id === d.data.id ? d.data : x)));
      setEdit(null);
    } catch (x) {
      if (x.status === 401 || x.status === 403) return onTidakSah();
      setErrEdit(x.message);
    } finally {
      setInfoEdit('');
      setMenyimpan(false);
    }
  };

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
            {fotos.length > 0 && (
              <div className={'galeri' + (fotos.length === 1 ? ' satu' : '')}>
                {fotos.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Foto bukti ${i + 1} di ${r.nama_tempat}`} loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            <div>
              <h3>{r.nama_tempat}</h3>
              <p>{r.alamat}</p>
              {r.latitude !== null && r.longitude !== null && (
                <p><a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer">
                  Buka di Google Maps</a> ({r.latitude}, {r.longitude})</p>
              )}
              {r.keterangan && <p className="ket"><strong>Keterangan:</strong> {r.keterangan}</p>}
              <p>Dilaporkan oleh {r.pelapor} pada {new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              <div className="aksi-kartu">
                <button type="button" className="sekunder" onClick={() => bukaEdit(r)}>Edit</button>
                <button type="button" className="bahaya" onClick={() => { setErrHapus(''); setTarget(r); }}>Hapus laporan</button>
              </div>
            </div>
          </article>
        );
      })}

      {edit && ef && (
        <div className="tirai">
          <div className="dialog lebar" role="dialog" aria-modal="true" aria-labelledby="judul-edit">
            <h2 id="judul-edit">Edit laporan</h2>
            <form onSubmit={simpan}>
              <label>Nama pelapor
                <input required value={ef.pelapor} onChange={isiEdit('pelapor')} />
              </label>
              <label>Nama tempat
                <input required value={ef.nama_tempat} onChange={isiEdit('nama_tempat')} />
              </label>
              <label>Lokasi / alamat
                <textarea required rows={3} value={ef.alamat} onChange={isiEdit('alamat')} />
              </label>
              <div className="koordinat">
                <label>Latitude
                  <input inputMode="text" autoComplete="off" autoCapitalize="none" value={ef.latitude} onChange={isiEdit('latitude')} />
                </label>
                <label>Longitude
                  <input inputMode="text" autoComplete="off" autoCapitalize="none" value={ef.longitude} onChange={isiEdit('longitude')} />
                </label>
              </div>
              <label>Keterangan tambahan <small>opsional</small>
                <textarea rows={4} value={ef.keterangan} onChange={isiEdit('keterangan')} />
              </label>
              <div>
                <p className="pilihan-foto">Foto saat ini ({fotoLama.length})</p>
                {fotoLama.length > 0 && (
                  <div className="grid-foto">
                    {fotoLama.map((url, i) => (
                      <div className="foto-item" key={url}>
                        <img src={url} alt={`Foto ${i + 1}`} />
                        <button type="button" onClick={() => setFotoLama((l) => l.filter((u) => u !== url))} disabled={menyimpan}>Hapus</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label>Tambah foto <small>opsional, bisa lebih dari satu (masing-masing 10 MB)</small>
                <input key={editKey} type="file" accept="image/*" multiple
                  onChange={(e) => setFotoBaru(Array.from(e.target.files || []))} />
              </label>
              <p className="pilihan-foto">
                Total foto setelah disimpan: {fotoLama.length + fotoBaru.length} dari {MAKS_FOTO}. Foto yang dihapus hilang permanen setelah Anda menekan Simpan.
              </p>
              {infoEdit && !errEdit && <p className="status" role="status">{infoEdit}</p>}
              {errEdit && <p className="status err" role="alert">{errEdit}</p>}
              <div className="aksi">
                <button type="button" className="sekunder" onClick={() => setEdit(null)} disabled={menyimpan}>Batal</button>
                <button type="submit" disabled={menyimpan}>{menyimpan ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {target && (
        <div className="tirai">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="judul-hapus">
            <h2 id="judul-hapus">Hapus laporan ini?</h2>
            <p>Laporan &quot;{target.nama_tempat}&quot; beserta fotonya akan dihapus permanen dan tidak bisa dikembalikan.</p>
            {errHapus && <p className="status err" role="alert">{errHapus}</p>}
            <div className="aksi">
              <button type="button" className="sekunder" onClick={() => setTarget(null)} disabled={menghapus}>Batal</button>
              <button type="button" className="bahaya-penuh" onClick={hapus} disabled={menghapus}>{menghapus ? 'Menghapus...' : 'Hapus'}</button>
            </div>
          </div>
        </div>
      )}
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
