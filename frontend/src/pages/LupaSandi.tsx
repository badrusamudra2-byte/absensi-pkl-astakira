import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Tombol, Galat, Label, Masukan } from '../komponen/ui';
import { Ikon } from '../komponen/Ikon';

/** POST /api/auth/lupa-password — jawaban selalu sama (server tidak membocorkan email). */
export default function LupaSandi() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [terkirim, setTerkirim] = useState(false);
  const [memroses, setMemroses] = useState(false);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErr('Isi email yang valid untuk menerima tautan atur ulang.');
      return;
    }
    setMemroses(true);
    try {
      await api<{ pesan: string }>('/auth/lupa-password', {
        method: 'POST',
        json: { email: email.trim() },
      });
      setTerkirim(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Terjadi kesalahan pada server.');
    } finally {
      setMemroses(false);
    }
  };

  return (
    <div className="login-bg relative grid min-h-screen w-full place-items-center p-4 md:p-6">
      <div className="w-full max-w-[450px]">
        <div className="mb-4 flex items-center justify-center gap-2.5 text-nv">
          <div className="grid size-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-[17px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,.8)]">
            A
          </div>
          <div>
            <b className="block text-[13px] font-extrabold leading-tight">Astakira Media</b>
            <small className="block text-[10px] font-semibold text-mu">Panel Absensi PKL dan Jurnal Kegiatan</small>
          </div>
        </div>

        <section className="rounded-[19px] border border-[#d7e1ef] bg-kartu p-6 shadow-[0_40px_80px_-40px_rgba(11,31,77,.45)] sm:p-8">
          <span className="grid size-11 place-items-center rounded-xl bg-pl text-pr">
            <Ikon nama={terkirim ? 'checkCircle' : 'mail'} className="size-5" />
          </span>
          <div className="mt-3 text-[10px] font-extrabold uppercase tracking-[1.3px] text-pr">Pemulihan akun</div>
          <h1 className="mt-1 text-[23px] font-extrabold tracking-tight">
            {terkirim ? 'Tautan sudah dikirim' : 'Lupa kata sandi'}
          </h1>

          {terkirim ? (
            <>
              <p className="mt-2 text-xs leading-relaxed text-mu">
                Jika email terdaftar, tautan atur ulang sudah dikirim. Periksa kotak masuk dan folder spam Anda.
              </p>
              <Link
                to="/login"
                className="mt-5 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-pr text-sm font-bold text-white no-underline shadow-sm transition hover:brightness-110"
              >
                <Ikon nama="arrow" className="size-4 rotate-180" />
                Kembali ke halaman masuk
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs leading-relaxed text-mu">
                Masukkan email akun. Kami akan mengirim tautan untuk membuat kata sandi baru.
              </p>
              <form onSubmit={kirim} noValidate className="mt-4">
                <Label htmlFor="ls-em" className="!mt-0">Email akun</Label>
                <div className="relative mt-1">
                  <Ikon nama="mail" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a99b0]" />
                  <Masukan
                    id="ls-em"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@astakira.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="!mt-0 !h-[42px] !pl-10"
                  />
                </div>
                <div className="mt-2 min-h-6">
                  <Galat pesan={err} />
                </div>
                <Tombol type="submit" className="mt-1 h-[42px] w-full" disabled={memroses}>
                  {memroses ? 'Mengirim…' : 'Kirim tautan atur ulang'}
                </Tombol>
              </form>
              <Link
                to="/login"
                className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-pr no-underline"
              >
                <Ikon nama="arrow" className="size-3.5 rotate-180" />
                Kembali ke halaman masuk
              </Link>
            </>
          )}
        </section>
        <p className="mt-4 text-center text-[9.5px] text-[#8a99b0]">Panel Absensi PKL v1.0 · Astakira Media</p>
      </div>
    </div>
  );
}
