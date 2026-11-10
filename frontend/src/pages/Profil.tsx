import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../konteks/Auth';
import { api, ApiError } from '../lib/api';
import { useToast } from '../komponen/Toast';
import { Kartu, Tombol, Galat, Label, MasukanSandi } from '../komponen/ui';
import type { ProfilPeserta, ProfilPembimbing, User } from '../lib/tipe';

const PERAN: Record<string, string> = { peserta: 'Peserta PKL', pembimbing: 'Pembimbing', admin: 'Admin' };

/** Modal tampilan foto profil besar, ditutup lewat latar, tombol, atau Esc. */
function ModalFoto({ url, nama, tutup }: { url: string; nama: string; tutup: () => void }) {
  useEffect(() => {
    const kbd = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutup();
    };
    window.addEventListener('keydown', kbd);
    return () => window.removeEventListener('keydown', kbd);
  }, [tutup]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={tutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Foto profil diperbesar"
        className="bg-kartu rounded-xl p-3 max-w-[92vw] max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={url} alt={`Foto profil ${nama}`} className="max-w-full max-h-[74vh] rounded-lg" />
        <p className="text-center mt-2">
          <Tombol varian="gh" onClick={tutup}>
            Tutup
          </Tombol>
        </p>
      </div>
    </div>
  );
}

export default function Profil() {
  const { user, profil, perbaruiUser } = useAuth();
  const toast = useToast();
  const file = useRef<HTMLInputElement | null>(null);

  const [p0, setP0] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [errPw, setErrPw] = useState('');
  const [memrosesPw, setMemrosesPw] = useState(false);
  const [lihatFoto, ubahLihatFoto] = useState(false);

  const potong = user?.nama?.[0] ?? '?';

  const gantiFoto = (daftar: FileList | null) => {
    const f = daftar?.[0];
    if (!f || !user) return;
    if (f.size > 2 * 1024 * 1024) {
      toast('Ukuran foto maksimal 2 MB.', 'warn');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      toast('Format foto harus JPEG, PNG, atau WebP.', 'warn');
      return;
    }
    const fd = new FormData();
    fd.append('foto', f);
    api<{ foto_url: string }>('/profil/foto', { method: 'POST', body: fd })
      .then((r) => {
        // foto_url berbentuk /uploads/foto/xxx — tampilkan nilai terbaru
        const u: User = { ...user, foto_url: r.foto_url };
        perbaruiUser(u);
        toast('Foto profil diperbarui', 'ok');
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : 'Gagal mengunggah foto.', 'warn'));
  };

  const ubahPw = async () => {
    setErrPw('');
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,72}$/.test(p1)) {
      setErrPw('Kata sandi baru minimal 8 karakter dan mengandung huruf serta angka.');
      return;
    }
    if (p1 !== p2) {
      setErrPw('Ulangi kata sandi baru dengan teks yang sama.');
      return;
    }
    setMemrosesPw(true);
    try {
      await api<{ pesan: string }>('/profil/password', {
        method: 'PUT',
        json: { password_lama: p0, password_baru: p1 },
      });
      setP0('');
      setP1('');
      setP2('');
      toast('Kata sandi diubah', 'ok');
    } catch (e) {
      setErrPw(e instanceof ApiError ? e.message : 'Terjadi kesalahan pada server.');
    } finally {
      setMemrosesPw(false);
    }
  };

  const divisi = profil ? (profil as ProfilPeserta | ProfilPembimbing).divisi : null;

  return (
    <>
      <Kartu t="Detail akun">
        <div className="flex items-center gap-4">
          {user?.foto_url ? (
            <button
              type="button"
              onClick={() => ubahLihatFoto(true)}
              aria-label="Lihat foto profil lebih besar"
              className="w-[72px] h-[72px] rounded-full overflow-hidden bg-pr text-white text-3xl font-extrabold grid place-items-center cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pr shrink-0"
            >
              <img src={user.foto_url} alt="Foto profil" className="w-full h-full object-cover" />
            </button>
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-pr text-white text-3xl font-extrabold grid place-items-center overflow-hidden shrink-0">
              {potong}
            </div>
          )}
          <div>
            <b className="block">{user?.nama}</b>
            <p className="text-mu text-sm">
              {user?.email}, {user ? PERAN[user.role] : ''}
              {divisi ? `, ${divisi}` : ''}
            </p>
            <label className="inline-block mt-2 text-sm font-semibold text-pr cursor-pointer">
              Ganti foto
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => gantiFoto(e.target.files)}
              />
            </label>
          </div>
        </div>
      </Kartu>

      <Kartu t="Ubah kata sandi">
        <Label htmlFor="pf-p0">Kata sandi saat ini</Label>
        <MasukanSandi id="pf-p0" autoComplete="current-password" value={p0} onChange={(e) => setP0(e.target.value)} />
        <Label htmlFor="pf-p1">Kata sandi baru</Label>
        <MasukanSandi id="pf-p1" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
        <Label htmlFor="pf-p2">Ulangi kata sandi baru</Label>
        <MasukanSandi id="pf-p2" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
        <div className="min-h-6 mt-2">
          <Galat pesan={errPw} />
        </div>
        <Tombol onClick={ubahPw} disabled={memrosesPw}>
          {memrosesPw ? 'Menyimpan…' : 'Simpan kata sandi'}
        </Tombol>
      </Kartu>

      {lihatFoto && user?.foto_url && (
        <ModalFoto url={user.foto_url} nama={user.nama ?? ''} tutup={() => ubahLihatFoto(false)} />
      )}
    </>
  );
}
