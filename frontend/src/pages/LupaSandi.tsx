import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Kartu, Tombol, Galat, Label, Masukan } from '../komponen/ui';

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
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <Kartu>
          <h2 className="text-xl font-bold mb-1">Lupa kata sandi</h2>
          {terkirim ? (
            <>
              <p>Jika email terdaftar, tautan atur ulang sudah dikirim. Periksa kotak masuk (dan spam) Anda.</p>
              <p className="mt-3 text-sm">
                <Link to="/login" className="text-pr font-semibold no-underline">
                  Kembali ke halaman masuk
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={kirim} noValidate>
              <Label htmlFor="ls-em">Email akun</Label>
              <Masukan
                id="ls-em"
                type="email"
                autoComplete="email"
                placeholder="nama@astakira.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="min-h-6 mt-2">
                <Galat pesan={err} />
              </div>
              <Tombol type="submit" className="w-full" disabled={memroses}>
                {memroses ? 'Mengirim…' : 'Kirim tautan atur ulang'}
              </Tombol>
              <p className="mt-3 text-sm">
                <Link to="/login" className="text-pr font-semibold no-underline">
                  Kembali ke halaman masuk
                </Link>
              </p>
            </form>
          )}
        </Kartu>
      </div>
    </div>
  );
}
