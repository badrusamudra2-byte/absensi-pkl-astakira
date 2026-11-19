import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../konteks/Auth';
import { api, ApiError } from '../lib/api';
import { useToast } from '../komponen/Toast';
import { Kartu, Tombol, Galat, Label, MasukanSandi, JudulHalaman } from '../komponen/ui';
import { Ikon } from '../komponen/Ikon';
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
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onClick={tutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Foto profil diperbesar"
        className="bg-kartu rounded-2xl p-3 max-w-[92vw] max-h-[92vh] overflow-auto shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={url} alt={`Foto profil ${nama}`} className="max-w-full max-h-[74vh] rounded-xl object-contain" />
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
  const pembimbing = profil && 'pembimbing' in profil ? (profil as ProfilPeserta).pembimbing?.nama ?? null : null;

  return (
    <>
      <JudulHalaman
        eyebrow={user ? `Akun ${PERAN[user.role]}` : 'Akun'}
        judul="Profil Saya"
        sub="Kelola foto profil dan keamanan akun Anda."
        aksi={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] text-[#15803d] px-3 py-1.5 text-[10.5px] font-bold">
            <span className="size-1.5 rounded-full bg-[#15803d]" aria-hidden="true" />
            Akun aktif
          </span>
        }
      />

      <div className="grid lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div>
          <Kartu className="!p-0 overflow-hidden">
            <div className="px-4 md:px-5 py-4 border-b border-garis bg-gradient-to-r from-[#f8fbff] to-[#ffffff]">
              <div className="flex items-center gap-4">
                {user?.foto_url ? (
                  <button
                    type="button"
                    onClick={() => ubahLihatFoto(true)}
                    aria-label="Lihat foto profil lebih besar"
                    className="relative size-[76px] rounded-full overflow-hidden bg-pr shrink-0 cursor-zoom-in ring-4 ring-pl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pr group"
                  >
                    <img src={user.foto_url} alt="Foto profil" className="w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition grid place-items-center text-white">
                      <Ikon nama="eye" className="size-5" />
                    </span>
                  </button>
                ) : (
                  <div className="size-[76px] rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1e40af] text-white text-2xl font-extrabold grid place-items-center overflow-hidden shrink-0 ring-4 ring-pl">
                    {potong}
                  </div>
                )}
                <div className="min-w-0">
                  <b className="block text-[15px] font-extrabold truncate">{user?.nama}</b>
                  <p className="text-[11.5px] text-mu truncate mt-0.5">{user?.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="rounded-md bg-pl text-pr px-2 py-0.5 text-[9.5px] font-bold">
                      {user ? PERAN[user.role] : ''}
                    </span>
                    {divisi ? <span className="text-[10px] text-mu">Divisi {divisi}</span> : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 md:px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-garis bg-kartu px-3 py-1.5 text-[11px] font-bold text-pr cursor-pointer hover:bg-pl transition">
                <Ikon nama="camera" className="size-3.5" />
                Ganti foto
                <input
                  ref={file}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => gantiFoto(e.target.files)}
                />
              </label>
              <small className="text-[9.5px] text-mu">JPEG, PNG, atau WebP · maksimal 2 MB</small>
            </div>
          </Kartu>

          <Kartu t="Detail akun">
            <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-3 m-0">
              {[
                { t: 'Nama lengkap', v: user?.nama },
                { t: 'Username', v: user?.username },
                { t: 'Email', v: user?.email },
                { t: 'Peran', v: user ? PERAN[user.role] : null },
                { t: 'Divisi', v: divisi },
                { t: 'Pembimbing', v: pembimbing },
              ].map((x) => (
                <div key={x.t} className="min-w-0">
                  <dt className="text-[9.5px] font-extrabold uppercase tracking-[.8px] text-mu">{x.t}</dt>
                  <dd className="text-[11.5px] font-semibold text-[#334155] mt-0.5 truncate m-0">{x.v || '—'}</dd>
                </div>
              ))}
            </dl>
          </Kartu>
        </div>

        <div>
          <Kartu t="Ubah kata sandi">
            <p className="text-[11px] text-mu -mt-1 mb-2">Gunakan kata sandi baru yang kuat dan mudah Anda ingat.</p>
            <Label htmlFor="pf-p0" className="!mt-0">Kata sandi saat ini</Label>
            <MasukanSandi id="pf-p0" autoComplete="current-password" value={p0} onChange={(e) => setP0(e.target.value)} />
            <Label htmlFor="pf-p1">Kata sandi baru</Label>
            <MasukanSandi id="pf-p1" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
            <Label htmlFor="pf-p2">Ulangi kata sandi baru</Label>
            <MasukanSandi id="pf-p2" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
            <div className="min-h-6 mt-1">
              <Galat pesan={errPw} />
            </div>
            <p className="text-[9.5px] text-mu mb-2">Minimal 8 karakter dan mengandung huruf serta angka.</p>
            <Tombol onClick={ubahPw} disabled={memrosesPw} className="w-full">
              <Ikon nama="lock" className="size-3.5" />
              {memrosesPw ? 'Menyimpan…' : 'Simpan kata sandi'}
            </Tombol>
          </Kartu>

          <Kartu t="Tips keamanan akun">
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {[
                { i: 'key' as const, t: 'Gunakan kata sandi unik', u: 'Jangan gunakan kata sandi yang sama dengan akun lain.' },
                { i: 'shield' as const, t: 'Jangan bagikan akun', u: 'Absensi dan jurnal tercatat atas nama pemilik akun.' },
                { i: 'users' as const, t: 'Perlu bantuan?', u: 'Hubungi pembimbing atau admin bila data akun tidak sesuai.' },
              ].map((x) => (
                <li key={x.t} className="flex items-start gap-2.5">
                  <span className="size-7 rounded-lg bg-pl text-pr grid place-items-center shrink-0">
                    <Ikon nama={x.i} className="size-3.5" />
                  </span>
                  <div>
                    <b className="block text-[11px] font-extrabold">{x.t}</b>
                    <p className="text-[10.5px] text-mu mt-0.5 leading-snug">{x.u}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Kartu>
        </div>
      </div>

      {lihatFoto && user?.foto_url && (
        <ModalFoto url={user.foto_url} nama={user.nama ?? ''} tutup={() => ubahLihatFoto(false)} />
      )}
    </>
  );
}
