import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../konteks/Auth';
import { ApiError } from '../lib/api';
import { Tombol, Galat, Label, Masukan, MasukanSandi } from '../komponen/ui';
import { Ikon } from '../komponen/Ikon';

const FITUR = [
  { ikon: 'qr' as const, judul: 'Absensi QR & verifikasi wajah', uraian: 'Kehadiran masuk dan pulang tercatat aman' },
  { ikon: 'book' as const, judul: 'Jurnal kegiatan harian', uraian: 'Isi, kirim, dan terima catatan revisi pembimbing' },
  { ikon: 'shield' as const, judul: 'Pengawasan terpusat', uraian: 'Pembimbing dan admin memantau dalam satu panel' },
];

export default function Login() {
  const { masuk } = useAuth();
  const navigate = useNavigate();
  const lokasi = useLocation();
  const dari = (lokasi.state as { dari?: string } | null)?.dari ?? '/';

  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [memroses, setMemroses] = useState(false);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!id.trim() || !pw) {
      setErr('Email/username dan kata sandi wajib diisi.');
      return;
    }
    setMemroses(true);
    try {
      await masuk(id.trim(), pw);
      navigate(dari, { replace: true });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Terjadi kesalahan pada server.');
    } finally {
      setMemroses(false);
    }
  };

  return (
    <div className="login-bg relative min-h-screen w-full grid place-items-center p-4 md:p-6">
      <div className="relative w-full max-w-[1080px]">
        <div className="flex items-center justify-center gap-2.5 mb-4 text-nv">
          <div className="size-[34px] rounded-[10px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white grid place-items-center text-[17px] font-extrabold shadow-[0_8px_18px_-8px_rgba(37,99,235,.8)]">
            A
          </div>
          <div>
            <b className="block text-[13px] font-extrabold leading-tight">Astakira Media</b>
            <small className="block text-[10px] text-mu font-semibold">Panel Absensi PKL dan Jurnal Kegiatan</small>
          </div>
        </div>

        <section
          className="grid md:grid-cols-[1.02fr_1fr] rounded-[20px] overflow-hidden bg-kartu border border-[#d7e1ef] shadow-[0_40px_80px_-40px_rgba(11,31,77,.45)]"
          aria-label="Halaman masuk"
        >
          <div className="login-grad hidden md:flex flex-col text-white p-10 lg:p-[42px] relative overflow-hidden">
            <div aria-hidden="true" className="pointer-events-none absolute -left-20 -bottom-32 size-80 rounded-full border border-blue-200/15" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 size-52 rounded-full border border-blue-200/10" />

            <div className="relative flex items-center gap-2.5 mb-9">
              <div className="size-[42px] rounded-xl bg-gradient-to-br from-[#60a5fa] to-[#1d4ed8] grid place-items-center text-xl font-extrabold">A</div>
              <div>
                <b className="block text-base font-extrabold leading-tight">Astakira Media</b>
                <small className="block text-[9.5px] text-[#8fb0ee] tracking-[.4px]">SISTEM ABSENSI PKL</small>
              </div>
            </div>

            <h1 className="relative text-[30px] lg:text-[34px] leading-[1.18] font-extrabold tracking-[-1px]">
              Panel Absensi PKL
              <br />
              <span className="text-[#93c5fd]">Astakira Media</span>
            </h1>
            <p className="relative text-[12.5px] leading-[1.7] text-[#c7d8f5] mt-3.5 max-w-[390px]">
              Absen dengan QR atau wajah, tulis jurnal harian, dan pantau kehadiran dalam satu tempat yang terintegrasi.
            </p>

            <div className="relative mt-7 flex flex-col gap-3">
              {FITUR.map((f) => (
                <div key={f.judul} className="flex items-start gap-2.5">
                  <span className="size-[30px] rounded-lg bg-white/10 border border-white/15 text-[#93c5fd] grid place-items-center shrink-0">
                    <Ikon nama={f.ikon} className="size-[15px]" />
                  </span>
                  <div>
                    <b className="block text-[11.5px] text-[#eaf1ff]">{f.judul}</b>
                    <small className="block text-[10px] text-[#9db4d9] mt-0.5">{f.uraian}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-auto pt-6 border-t border-white/10 flex justify-between text-[9.5px] text-[#8fa8cf]">
              <span>&copy; 2026 Astakira Media</span>
              <span>Sistem Informasi PKL</span>
            </div>
          </div>

          <div className="p-6 sm:p-9 lg:px-14 lg:py-12 flex flex-col justify-center">
            <div className="text-[10px] font-extrabold tracking-[1.4px] uppercase text-pr">Selamat datang kembali</div>
            <h2 className="text-2xl sm:text-[27px] font-extrabold tracking-[-.7px] mt-1">Masuk ke akun</h2>
            <p className="text-[11.5px] text-mu mt-1.5 mb-6">
              Gunakan email atau username yang diberikan admin untuk melanjutkan.
            </p>

            <form onSubmit={kirim} noValidate>
              <Label htmlFor="lg-em" className="!mt-0">Email atau username</Label>
              <div className="relative mt-1">
                <Ikon nama="mail" className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8a99b0]" />
                <Masukan
                  id="lg-em"
                  autoComplete="username"
                  placeholder="peserta@astakira.id"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="!mt-0 !pl-10 !h-[42px]"
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <Label htmlFor="lg-pw" className="!mt-0">Kata sandi</Label>
                <Link to="/lupa-sandi" className="text-[10.5px] font-bold text-pr no-underline">
                  Lupa kata sandi?
                </Link>
              </div>
              <MasukanSandi
                id="lg-pw"
                autoComplete="current-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="!h-[42px]"
              />
              <div className="min-h-6 mt-2">
                <Galat pesan={err} />
              </div>
              <Tombol type="submit" className="w-full !h-[43px] mt-1" disabled={memroses}>
                {memroses ? 'Memproses…' : 'Masuk'}
              </Tombol>
            </form>

            <div className="flex items-center gap-2.5 text-[9.5px] text-[#9aa9bf] my-5">
              <span className="h-px bg-garis flex-1" />
              AKSES TERBATAS
              <span className="h-px bg-garis flex-1" />
            </div>
            <p className="text-[10.5px] text-mu text-center leading-relaxed">
              Akun peserta, pembimbing, dan admin dibuat oleh <b className="text-[#334155]">administrator</b>.
              <br />
              Hubungi admin bila Anda belum memiliki akses.
            </p>
            <p className="text-[9.5px] text-[#8a99b0] text-center mt-4">Panel Absensi PKL v1.0 · Astakira Media</p>
          </div>
        </section>
      </div>
    </div>
  );
}
