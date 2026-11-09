import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Kartu, Tombol, Galat, Label, Masukan } from '../komponen/ui';

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
    if (pw.length < 8) {
      setErr('Kata sandi baru minimal 8 karakter.');
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
      <div className="min-h-screen grid place-items-center p-4">
        <div className="w-full max-w-md">
          <Kartu>
            <h2 className="text-xl font-bold mb-1">Tautan tidak berlaku</h2>
            <p className="text-mu text-sm">Tautan atur ulang tidak membawa token yang valid. Mintalah tautan baru.</p>
            <p className="mt-3 text-sm">
              <Link to="/lupa-sandi" className="text-pr font-semibold no-underline">
                Minta tautan atur ulang
              </Link>
            </p>
          </Kartu>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <Kartu>
          {sukses ? (
            <>
              <h2 className="text-xl font-bold mb-1">Kata sandi berhasil diubah</h2>
              <p>Silakan masuk dengan kata sandi baru Anda.</p>
              <p className="mt-3 text-sm">
                <Link to="/login" className="text-pr font-semibold no-underline">
                  Halaman masuk
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-1">Buat kata sandi baru</h2>
              <form onSubmit={kirim} noValidate>
            <Label htmlFor="rs-pw">Kata sandi baru</Label>
            <Masukan id="rs-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <Label htmlFor="rs-pw2">Ulangi kata sandi baru</Label>
            <Masukan id="rs-pw2" type="password" autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} />
            <div className="min-h-6 mt-2">
              <Galat pesan={err} />
            </div>
            <Tombol className="w-full" disabled={memroses}>
              {memroses ? 'Menyimpan…' : 'Simpan kata sandi baru'}
            </Tombol>
          </form>
            </>
          )}
        </Kartu>
      </div>
    </div>
  );
}
