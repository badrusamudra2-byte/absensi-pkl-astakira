import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Absensi, Jenis, MetodeAbsensi, Workshift } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { Link } from 'react-router-dom';
import { isoHariIni } from '../../komponen/umum';
import { useOnline } from '../../komponen/Offline';

export default function Absensi() {
  const navigate = useNavigate();
  const daring = useOnline();
  const [jenis, setJenis] = useState<Jenis>('masuk');
  const [mode, ubahMode] = useState<MetodeAbsensi | null>(null);
  const [jadwal, setJadwal] = useState<Workshift[] | null>(null);
  const [galatJadwal, setGalatJadwal] = useState('');
  // Absensi hari ini: jenis yang sudah tercatat tidak bisa dimulai lagi
  const [hariIniRow, ubahHariIniRow] = useState<Absensi[]>([]);

  useEffect(() => {
    api<{ metode: MetodeAbsensi }>('/pengaturan/absensi')
      .then((r) => ubahMode(r.metode))
      .catch(() => ubahMode('qr_wajah')); // gagal baca: pakai mode paling aman
    api<{ data: Workshift[] }>('/workshift')
      .then((r) => setJadwal(r.data))
      .catch(() => setGalatJadwal('Jadwal kerja belum bisa dimuat. Pastikan server aktif lalu muat ulang halaman.'));
    api<{ data: Absensi[] }>('/absensi/riwayat')
      .then((r) => ubahHariIniRow(r.data.filter((x) => x.tanggal === isoHariIni())))
      .catch(() => ubahHariIniRow([])); // gagal: layar biarkan bisa absen; server tetap menolak dobel
  }, []);

  const potong = (t?: string) => (t ? t.slice(0, 5) : '-'); // "08:00:00" -> "08:00"
  const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
  const w = jadwal?.find((x: Workshift) => x.hari === hariIni) ?? null;
  // Baris absensi jenis ini yang hari ini sudah tercatat (null = belum absen)
  const tercatat = () => hariIniRow.find((x) => x.jenis === jenis) ?? null;

  /* Rute lanjutan menurut metode absensi penyelenggara.
   * qr_wajah: verifikasi wajah di HP peserta dulu (foto disimpan untuk rekap), lalu QR tayang;
   * qr: QR langsung; wajah: absensi tercatat langsung setelah wajah cocok. */
  const mulai = () => {
    if (mode === null) return; // pengaturan belum diketahui — tombol juga dinonaktifkan
    if (mode === 'wajah') {
      return navigate(`/wajah/periksa?jenis=${jenis}&genap=langsung`);
    }
    if (mode === 'qr_wajah') {
      return navigate(`/wajah/periksa?jenis=${jenis}&genap=scan`);
    }
    return navigate(`/absensi/qr?jenis=${jenis}`); // mode qr: tayangkan QR milik peserta
  };

  const teksMode =
    mode === 'qr'
      ? 'Metode saat ini: tunjukkan QR Anda untuk dipindai pembimbing (tanpa verifikasi wajah).'
      : mode === 'wajah'
        ? 'Metode saat ini: absen langsung setelah wajah cocok dan liveness lolos (tanpa QR).'
        : 'Metode saat ini: verifikasi wajah di HP Anda dulu, lalu tunjukkan QR Anda ke pembimbing.';

  return (
    <>
      <Kartu t="Pilih jenis absensi">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['masuk', 'pulang'] as Jenis[]).map((m) => {
            const terCatat = hariIniRow.find((x) => x.jenis === m) ?? null;
            return (
              <button
                key={m}
                onClick={() => setJenis(m)}
                aria-pressed={jenis === m}
                className={`text-left rounded-xl p-4 border-2 cursor-pointer font-sans ${
                  jenis === m ? 'border-pr bg-pl' : 'border-garis bg-kartu'
                }`}
              >
                <b className="block">Absen {m}</b>
                {terCatat ? (
                  <small className="inline-flex items-center gap-1 mt-1">
                    <span className="text-g font-semibold">Tercatat {potong(terCatat.jam)}</span>
                    <Badge s={terCatat.status} />
                  </small>
                ) : (
                  <small className="text-mu">
                    {m === 'masuk' ? 'Tandai kehadiran awal hari kerja' : 'Tandai waktu pulang hari kerja'}
                  </small>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <Tombol onClick={mulai} disabled={!daring || mode === null || tercatat() !== null}>
            {tercatat() ? `Sudah absen ${jenis} (${potong(tercatat()!.jam)})` : mode === null ? 'Memuat metode…' : `Mulai absen ${jenis}`}
          </Tombol>
          {tercatat() ? (
            <p className="text-mu text-sm mt-1 font-semibold">
              Absen {jenis} hari ini sudah tercatat pada {potong(tercatat()!.jam)} — cukup sekali per jenis.
            </p>
          ) : null}
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
            dibuka 5 menit sebelum jam pulang dan dilakukan dengan cara yang sama (QR/wajah).
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
