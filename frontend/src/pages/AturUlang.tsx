import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Tombol, Galat, Label, MasukanSandi } from '../komponen/ui';
import { Ikon } from '../komponen/Ikon';

/** POST /api/auth/reset-password dengan token dari email (?token=...). */
export default function AturUlang() {
  const [cari] = useSearchParams();
  const token = cari.get('token') ?? '';

  const [pw, setPw] = useState('');
  const [ulang, setUlang] = useState('');
  const [err, setErr] = useState('');
  const [sukses, setSukses] = useState(false);
  const [memroses, setMemroses] = useState(false);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,72}$/.test(pw)) {
      setErr('Kata sandi minimal 8 karakter dan mengandung huruf serta angka.');
      return;
    }
    if (pw !== ulang) {
      setErr('Ulangi kata sandi baru dengan teks yang sama.');
      return;
    }
    setMemroses(true);
    try {
      await api<{ pesan: string }>('/auth/reset-password', { method: 'POST', json: { token, password: pw } });
      setSukses(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Terjadi kesalahan pada server.');
    } finally {
      setMemroses(false);
    }
  };

  if (!token) {
    return (
      <div className="login-bg relative grid min-h-screen w-full place-items-center p-4 md:p-6">
        <div className="w-full max-w-[450px]">
          <div className="mb-4 flex items-center justify-center gap-2.5 text-nv">
            <div className="grid size-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-[17px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,.8)]">A</div>
            <div>
              <b className="block text-[13px] font-extrabold leading-tight">Astakira Media</b>
              <small className="block text-[10px] font-semibold text-mu">Panel Absensi PKL dan Jurnal Kegiatan</small>
            </div>
          </div>
          <section className="rounded-[19px] border border-[#d7e1ef] bg-kartu p-6 shadow-[0_40px_80px_-40px_rgba(11,31,77,.45)] sm:p-8">
            <span className="grid size-11 place-items-center rounded-xl bg-[#b91c1c12] text-r">
              <Ikon nama="alert" className="size-5" />
            </span>
            <div className="mt-3 text-[10px] font-extrabold uppercase tracking-[1.3px] text-r">Tautan bermasalah</div>
            <h1 className="mt-1 text-[23px] font-extrabold tracking-tight">Tautan tidak berlaku</h1>
            <p className="mt-2 text-xs leading-relaxed text-mu">
              Tautan atur ulang tidak membawa token yang valid. Mintalah tautan baru dari halaman lupa kata sandi.
            </p>
            <Link
              to="/lupa-sandi"
              className="mt-5 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-pr text-sm font-bold text-white no-underline shadow-sm transition hover:brightness-110"
            >
              <Ikon nama="mail" className="size-4" />
              Minta tautan atur ulang
            </Link>
          </section>
          <p className="mt-4 text-center text-[9.5px] text-[#8a99b0]">Panel Absensi PKL v1.0 · Astakira Media</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg relative grid min-h-screen w-full place-items-center p-4 md:p-6">
      <div className="w-full max-w-[450px]">
        <div className="mb-4 flex items-center justify-center gap-2.5 text-nv">
          <div className="grid size-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-[17px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,.8)]">A</div>
          <div>
            <b className="block text-[13px] font-extrabold leading-tight">Astakira Media</b>
            <small className="block text-[10px] font-semibold text-mu">Panel Absensi PKL dan Jurnal Kegiatan</small>
          </div>
        </div>

        <section className="rounded-[19px] border border-[#d7e1ef] bg-kartu p-6 shadow-[0_40px_80px_-40px_rgba(11,31,77,.45)] sm:p-8">
          <span className="grid size-11 place-items-center rounded-xl bg-pl text-pr">
            <Ikon nama={sukses ? 'checkCircle' : 'key'} className="size-5" />
          </span>
          <div className="mt-3 text-[10px] font-extrabold uppercase tracking-[1.3px] text-pr">Keamanan akun</div>
          <h1 className="mt-1 text-[23px] font-extrabold tracking-tight">
            {sukses ? 'Kata sandi berhasil diubah' : 'Buat kata sandi baru'}
          </h1>

          {sukses ? (
            <>
              <p className="mt-2 text-xs leading-relaxed text-mu">
                Silakan masuk dengan kata sandi baru Anda.
              </p>
              <Link
                to="/login"
                className="mt-5 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-pr text-sm font-bold text-white no-underline shadow-sm transition hover:brightness-110"
              >
                <Ikon nama="arrow" className="size-4" />
                Halaman masuk
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs leading-relaxed text-mu">
                Gunakan kata sandi yang kuat dan tidak dipakai di layanan lain.
              </p>
              <form onSubmit={kirim} noValidate className="mt-4">
                <Label htmlFor="rs-pw" className="!mt-0">Kata sandi baru</Label>
                <MasukanSandi id="rs-pw" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="!h-[42px]" />
                <Label htmlFor="rs-pw2">Ulangi kata sandi baru</Label>
                <MasukanSandi id="rs-pw2" autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} className="!h-[42px]" />
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-mu">Minimal 8 karakter, mengandung huruf dan angka.</p>
                <div className="mt-2 min-h-6">
                  <Galat pesan={err} />
                </div>
                <Tombol type="submit" className="mt-1 h-[42px] w-full" disabled={memroses}>
                  {memroses ? 'Menyimpan…' : 'Simpan kata sandi baru'}
                </Tombol>
              </form>
            </>
          )}
        </section>
        <p className="mt-4 text-center text-[9.5px] text-[#8a99b0]">Panel Absensi PKL v1.0 · Astakira Media</p>
      </div>
    </div>
  );
}
