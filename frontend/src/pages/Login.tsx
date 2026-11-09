import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../konteks/Auth';
import { ApiError } from '../lib/api';
import { Kartu, Tombol, Galat, Label, Masukan } from '../komponen/ui';

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
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden border border-garis bg-kartu">
        <div className="bg-nv text-white p-8 flex flex-col justify-center gap-3">
          <h1 className="text-2xl font-extrabold leading-snug">
            Panel Absensi PKL<br />
            SMKN 3 Banjar 
          </h1>
          <p className="text-nv-t text-sm">
            Absen dengan QR atau wajah, tulis jurnal harian, dan pantau kehadiran dalam satu tempat.
          </p>
        </div>
        <div className="p-6 md:p-8">
          <Kartu className="!border-0 !bg-transparent !p-0">
            <h2 className="text-[22px] font-bold mb-1">Masuk</h2>
            <form onSubmit={kirim} noValidate>
              <Label htmlFor="lg-em">Email atau username</Label>
              <Masukan
                id="lg-em"
                autoComplete="username"
                placeholder="peserta@astakira.id"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
              <Label htmlFor="lg-pw">Kata sandi</Label>
              <Masukan
                id="lg-pw"
                type="password"
                autoComplete="current-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <div className="min-h-6 mt-2">
                <Galat pesan={err} />
              </div>
              <Tombol className="w-full mt-1" disabled={memroses}>
                {memroses ? 'Memproses…' : 'Masuk'}
              </Tombol>
              <p className="mt-3 text-sm">
                <Link to="/lupa-sandi" className="text-pr font-semibold no-underline">
                  Lupa kata sandi?
                </Link>
              </p>
            </form>
          </Kartu>
        </div>
      </div>
    </div>
  );
}
