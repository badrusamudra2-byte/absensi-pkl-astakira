import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Absensi, Jenis, MetodeAbsensi, Workshift } from '../../lib/tipe';
import { Kartu, Tombol, Badge, JudulHalaman } from '../../komponen/ui';
import { isoHariIni, penandaOtomatis, tercatatPada } from '../../komponen/umum';
import { useOnline } from '../../komponen/Offline';
import { Ikon } from '../../komponen/Ikon';

export default function Absensi() {
  const navigate = useNavigate();
  const daring = useOnline();
  const [jenis, setJenis] = useState<Jenis>('masuk');
  const [mode, ubahMode] = useState<MetodeAbsensi | null>(null);
  const [jadwal, setJadwal] = useState<Workshift[] | null>(null);
  const [galatJadwal, setGalatJadwal] = useState('');
  const [hariIniRow, ubahHariIniRow] = useState<Absensi[]>([]);

  useEffect(() => {
    api<{ metode: MetodeAbsensi }>('/pengaturan/absensi')
      .then((r) => ubahMode(r.metode))
      .catch(() => ubahMode('qr_wajah'));
    api<{ data: Workshift[] }>('/workshift')
      .then((r) => setJadwal(r.data))
      .catch(() => setGalatJadwal('Jadwal kerja belum bisa dimuat. Pastikan server aktif lalu muat ulang halaman.'));
    api<{ data: Absensi[] }>('/absensi/riwayat')
      .then((r) => ubahHariIniRow(r.data.filter((x) => x.tanggal === isoHariIni())))
      .catch(() => ubahHariIniRow([]));
  }, []);

  const potong = (t?: string) => (t ? t.slice(0, 5) : '-');
  const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
  const w = jadwal?.find((x: Workshift) => x.hari === hariIni) ?? null;
  const tglHariIni = isoHariIni();
  const barisHari = hariIniRow.find((x) => x.tanggal === tglHariIni) ?? null;
  const izinHari = barisHari && (barisHari.status === 'Izin' || barisHari.status === 'Sakit') ? barisHari : null;
  const tercatat = (j: Jenis) => tercatatPada(hariIniRow, tglHariIni, j);

  const mulai = () => {
    if (mode === null) return;
    if (mode === 'wajah') {
      return navigate(`/wajah/periksa?jenis=${jenis}&genap=langsung`);
    }
    if (mode === 'qr_wajah') {
      return navigate(`/wajah/periksa?jenis=${jenis}&genap=scan`);
    }
    return navigate(`/absensi/qr?jenis=${jenis}`);
  };

  const teksMode =
    mode === null
      ? 'Memuat metode absensi dari server…'
      : mode === 'qr'
        ? 'Metode saat ini: tunjukkan QR Anda untuk dipindai pembimbing (tanpa verifikasi wajah).'
        : mode === 'wajah'
          ? 'Metode saat ini: absen langsung setelah wajah cocok dan liveness lolos (tanpa QR).'
          : 'Metode saat ini: verifikasi wajah di HP Anda dulu, lalu tunjukkan QR Anda ke pembimbing.';

  const labelMode = mode === 'qr' ? 'QR' : mode === 'wajah' ? 'Wajah' : mode === 'qr_wajah' ? 'QR + Wajah' : 'Memuat…';

  return (
    <>
      <JudulHalaman
        eyebrow="Peserta PKL"
        judul="Absensi Masuk / Pulang"
        sub="Pilih jenis absensi, lalu lakukan verifikasi wajah dan QR."
      />

      {izinHari ? (
        <Kartu>
          <div className="text-center py-4">
            <div className="size-16 rounded-full bg-[#dcfce7] text-[#15803d] grid place-items-center mx-auto mb-3">
              <Ikon nama="checkCircle" className="size-8" />
            </div>
            <h2 className="text-lg font-extrabold mb-2">Anda sudah mengajukan {izinHari.status.toLowerCase()}</h2>
            <p className="text-[12.5px] text-[#4a5a72]">
              Hari ini tercatat <Badge s={izinHari.status} /> &mdash; absensi masuk dan pulang tidak perlu dilakukan.
            </p>
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              <Tombol varian="gh" onClick={() => navigate('/riwayat')}>Lihat riwayat</Tombol>
              <Tombol onClick={() => navigate('/')}>Selesai</Tombol>
            </div>
          </div>
        </Kartu>
      ) : (
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
          <div>
            <Kartu t="Pilih jenis absensi">
              <p className="text-[11px] text-mu -mt-1 mb-3">Satu kali per jenis setiap hari.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['masuk', 'pulang'] as Jenis[]).map((m) => {
                  const terCatat = tercatat(m);
                  return (
                    <button
                      key={m}
                      onClick={() => setJenis(m)}
                      aria-pressed={jenis === m}
                      className={`text-left rounded-xl p-3.5 border-2 cursor-pointer font-sans transition ${
                        jenis === m
                          ? 'border-pr bg-pl shadow-[0_10px_24px_-22px_rgba(29,78,216,.9)]'
                          : 'border-garis bg-[#fbfcfe] hover:border-[#b8c9e8]'
                      }`}
                    >
                      <span
                        className={`size-9 rounded-lg grid place-items-center mb-2.5 ${
                          jenis === m ? 'bg-pr text-white' : 'bg-[#eef2f8] text-[#5b6c85]'
                        }`}
                      >
                        <Ikon nama={m === 'masuk' ? 'absen' : 'logout'} className="size-[17px]" />
                      </span>
                      <b className="block text-[12.5px] font-extrabold">Absen {m}</b>
                      {terCatat ? (
                        <small className="inline-flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-g font-semibold">Tercatat {potong(terCatat.jam)}</span>
                          <Badge s={terCatat.status} />
                        </small>
                      ) : barisHari && penandaOtomatis(barisHari) && m === 'masuk' ? (
                        <small className="text-y font-semibold text-[10.5px]">Penanda otomatis: Tidak hadir</small>
                      ) : (
                        <small className="text-mu text-[10.5px]">
                          {m === 'masuk' ? 'Tandai kehadiran awal hari kerja' : 'Tandai waktu pulang hari kerja'}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-[#d8e3f6] bg-[#f6f9ff] p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[1px] text-pr mb-1">
                  <Ikon nama="info" className="size-3.5" />
                  Metode {labelMode}
                </div>
                <p className="text-[11.5px] text-[#4a5a72]" role="status" aria-live="polite">{teksMode}</p>
              </div>

              <div className="mt-3">
                <Tombol
                  className="w-full sm:w-auto"
                  onClick={mulai}
                  disabled={!daring || mode === null || tercatat(jenis) !== null}
                >
                  {tercatat(jenis)
                    ? `Sudah absen ${jenis} (${potong(tercatat(jenis)!.jam)})`
                    : mode === null ? 'Memuat metode…' : `Mulai absen ${jenis}`}
                </Tombol>
                {tercatat(jenis) ? (
                  <p className="text-mu text-[11.5px] mt-2 font-semibold">
                    Absen {jenis} hari ini sudah tercatat pada {potong(tercatat(jenis)!.jam)} — cukup sekali per jenis.
                  </p>
                ) : null}
                {barisHari && penandaOtomatis(barisHari) && tercatat(jenis) === null ? (
                  <p className="text-y text-[11.5px] mt-2 font-semibold" role="status">
                    Anda tercatat Tidak hadir oleh sistem (otomatis). Bila Anda datang, absen seperti biasa —
                    penanda otomatis akan diganti absensi asli Anda.
                  </p>
                ) : null}
                {!daring ? <p className="text-r text-[11.5px] mt-2 font-semibold" role="alert">Anda sedang luring — hubungkan internet untuk absen.</p> : null}
              </div>

              <div className="mt-4 pt-3 border-t border-garis flex flex-wrap items-center justify-between gap-2">
                <Link to="/riwayat" className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-pr no-underline">
                  <Ikon nama="clock" className="size-3.5" />
                  Lihat riwayat
                </Link>
                <Link to="/wajah/daftar" className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-mu no-underline hover:text-pr">
                  <Ikon nama="face" className="size-3.5" />
                  Daftarkan / cek pendaftaran wajah
                </Link>
              </div>
            </Kartu>

            <Kartu t="Alur absensi">
              <ol className="list-none p-0 m-0 grid sm:grid-cols-3 gap-3">
                {[
                  { n: '1', t: 'Pilih jenis', u: 'Masuk atau pulang', i: 'absen' as const },
                  { n: '2', t: 'Verifikasi wajah', u: 'Liveness dan kecocokan', i: 'face' as const },
                  { n: '3', t: 'Tunjukkan QR', u: 'Dipindai pembimbing', i: 'qr' as const },
                ].map((s) => (
                  <li key={s.n} className="rounded-xl border border-garis bg-[#fbfcfe] p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="size-6 rounded-full bg-pl text-pr text-[10px] font-extrabold grid place-items-center">{s.n}</span>
                      <Ikon nama={s.i} className="size-4 text-[#8a99b0]" />
                    </div>
                    <b className="block text-[11.5px] font-extrabold">{s.t}</b>
                    <small className="block text-[10.5px] text-mu mt-0.5">{s.u}</small>
                  </li>
                ))}
              </ol>
            </Kartu>
          </div>

          <div>
            <Kartu t="Jam kerja hari ini">
              {galatJadwal ? (
                <p className="text-r text-[11.5px] font-semibold" role="alert">{galatJadwal}</p>
              ) : jadwal === null ? (
                <p className="text-mu text-[11.5px]">Memuat jadwal…</p>
              ) : w && w.hari_kerja ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-2 rounded-full bg-[#15803d]" aria-hidden="true" />
                    <span className="text-[10px] font-extrabold uppercase tracking-[1px] text-[#15803d]">Hari kerja</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-[#f6f9ff] border border-[#e0e9f8] p-3">
                      <div className="text-[9.5px] font-bold uppercase tracking-wide text-mu">Masuk</div>
                      <div className="text-lg font-extrabold tracking-tight mt-0.5">{potong(w.jam_masuk)}</div>
                    </div>
                    <div className="rounded-xl bg-[#f6f9ff] border border-[#e0e9f8] p-3">
                      <div className="text-[9.5px] font-bold uppercase tracking-wide text-mu">Pulang</div>
                      <div className="text-lg font-extrabold tracking-tight mt-0.5">{potong(w.jam_pulang)}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-mu leading-relaxed mt-3">
                    Toleransi keterlambatan <b className="text-[#334155]">{w.toleransi_menit} menit</b>. Absen masuk
                    dihitung <b className="text-[#334155]">Terlambat</b> bila lewat {potong(w.jam_masuk)} +{' '}
                    {w.toleransi_menit} menit. Absen pulang dibuka 5 menit sebelum jam pulang.
                  </p>
                </>
              ) : (
                <p className="text-y font-semibold text-[11.5px]">
                  {w ? 'Hari ini bukan hari kerja (HARI_LIBUR).' : 'Jadwal untuk hari ini belum tersedia.'}
                </p>
              )}
            </Kartu>

            <Kartu t="Perlu diketahui">
              <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
                {[
                  'Kehadiran hanya tercatat satu kali untuk setiap jenis absensi per hari.',
                  'Bila sedang luring, hubungkan internet lebih dulu — absensi membutuhkan server.',
                  'Datang terlambat? Anda tetap dapat absen; status tercatat Terlambat secara otomatis.',
                ].map((t, i) => (
                  <li key={t} className="flex items-start gap-2 text-[11px] text-[#4a5a72] leading-snug">
                    <Ikon nama={i === 1 ? 'info' : 'checkCircle'} className="size-3.5 text-pr shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Kartu>
          </div>
        </div>
      )}
    </>
  );
}
