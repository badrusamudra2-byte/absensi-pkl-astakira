import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Jenis, MetodeAbsensi, Workshift } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan } from '../../komponen/ui';
import { Link } from 'react-router-dom';
import { useOnline } from '../../komponen/Offline';

export default function Absensi() {
  const navigate = useNavigate();
  const daring = useOnline();
  const [jenis, setJenis] = useState<Jenis>('masuk');
  const [mode, ubahMode] = useState<MetodeAbsensi | null>(null);
  const [jadwal, setJadwal] = useState<Workshift[] | null>(null);
  const [galatJadwal, setGalatJadwal] = useState('');

  useEffect(() => {
    api<{ metode: MetodeAbsensi }>('/pengaturan/absensi')
      .then((r) => ubahMode(r.metode))
      .catch(() => ubahMode('qr_wajah')); // gagal baca: pakai mode paling aman
    api<{ data: Workshift[] }>('/workshift')
      .then((r) => setJadwal(r.data))
      .catch(() => setGalatJadwal('Jadwal kerja belum bisa dimuat. Pastikan server aktif lalu muat ulang halaman.'));
  }, []);

  const potong = (t?: string) => (t ? t.slice(0, 5) : '-'); // "08:00:00" -> "08:00"
  const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
  const w = jadwal?.find((x: Workshift) => x.hari === hariIni) ?? null;

  /* Rute lanjutan menurut metode absensi penyelenggara.
   * Absen pulang selalu lewat wajah (tanpa QR), apapun metode globalnya. */
  const mulai = () => {
    if (jenis === 'pulang' || mode === 'wajah') {
      return navigate(`/wajah/periksa?jenis=${jenis}&genap=langsung`);
    }
    if (mode === 'qr') return navigate(`/absensi/scan?jenis=${jenis}`);
    return navigate(`/wajah/periksa?jenis=${jenis}&genap=scan`); // qr_wajah: wajah dulu, lalu scan QR
  };

  const teksMode =
    mode === 'qr'
      ? 'Metode saat ini: pindai QR yang ditayangkan pembimbing (tanpa verifikasi wajah).'
      : mode === 'wajah'
        ? 'Metode saat ini: absen langsung setelah wajah cocok dan liveness lolos (tanpa QR).'
        : 'Metode saat ini: verifikasi wajah dulu, lalu pindai QR yang ditayangkan pembimbing.';

  return (
    <>
      <Kartu t="Pilih jenis absensi">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['masuk', 'pulang'] as Jenis[]).map((m) => (
            <button
              key={m}
              onClick={() => setJenis(m)}
              aria-pressed={jenis === m}
              className={`text-left rounded-xl p-4 border-2 cursor-pointer font-sans ${
                jenis === m ? 'border-pr bg-pl' : 'border-garis bg-kartu'
              }`}
            >
              <b className="block">Absen {m}</b>
              <small className="text-mu">{m === 'masuk' ? 'Tandai kehadiran awal hari kerja' : 'Tandai waktu pulang hari kerja'}</small>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Tombol onClick={mulai} disabled={!daring}>Mulai absen {jenis}</Tombol>
          {!daring ? <p className="text-r text-sm mt-1 font-semibold" role="alert">Anda sedang luring — hubungkan internet untuk absen.</p> : null}
        </div>
        <p className="text-mu text-sm mt-2" role="status" aria-live="polite">{teksMode}</p>
        <p className="mt-1">
          <Link to="/wajah/daftar" className="text-pr font-semibold underline">Daftarkan / cek pendaftaran wajah</Link>
        </p>
      </Kartu>
      <Kartu t="Jam kerja hari ini">
        {galatJadwal ? (
          <p className="text-r text-sm font-semibold" role="alert">{galatJadwal}</p>
        ) : jadwal === null ? (
          <p className="text-mu text-sm">Memuat jadwal…</p>
        ) : w && w.hari_kerja ? (
          <p>
            Masuk {potong(w.jam_masuk)}, pulang {potong(w.jam_pulang)}. Absen masuk dihitung{' '}
            <b>Terlambat</b> bila lewat {w.jam_masuk.slice(0, 5)} + {w.toleransi_menit} menit toleransi. Absen pulang
            dibuka 5 menit sebelum jam pulang dan cukup dengan verifikasi wajah.
          </p>
        ) : (
          <p className="text-y font-semibold">
            {w ? 'Hari ini bukan hari kerja (HARI_LIBUR).' : 'Jadwal untuk hari ini belum tersedia.'}
          </p>
        )}
      </Kartu>
    </>
  );
}
