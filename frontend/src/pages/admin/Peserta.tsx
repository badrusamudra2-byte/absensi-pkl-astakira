import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisAdminUser } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Label, Masukan, Badge } from '../../komponen/ui';
import { FxDaftar } from '../../komponen/umum';
import { useToast } from '../../komponen/Toast';
import { Ikon } from '../../komponen/Ikon';

interface FormNilai {
  id?: number;
  nama: string;
  username: string;
  email: string;
  password: string;
  divisi: string;
  pembimbing_id: number | '';
}

const kosong: FormNilai = { nama: '', username: '', email: '', password: '', divisi: '', pembimbing_id: '' };

/** Kelola peserta: tambah, edit, nonaktifkan, hapus aman (tolak bila punya riwayat). */
export default function Peserta() {
  const toast = useToast();
  const [rows, ubahRows] = useState<BarisAdminUser[] | null>(null);
  const [pembimbing, ubahPembimbing] = useState<{ id: number; nama: string }[]>([]);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [form, ubahForm] = useState<FormNilai | null>(null);
  const [sedang, ubahSedang] = useState(false);

  const muat = useCallback(async () => {
    ubahRows(null);
    try {
      const r = await api<{ data: BarisAdminUser[] }>('/admin/peserta');
      ubahRows(r.data);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    }
  }, []);

  useEffect(() => {
    void muat();
    api<{ data: BarisAdminUser[] }>('/admin/pembimbing')
      .then((r) => ubahPembimbing(r.data.filter((p) => p.aktif).map((p) => ({ id: p.id, nama: p.nama }))))
      .catch(() => ubahPembimbing([]));
  }, [muat]);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    ubahSedang(true);
    ubahGalat(null);
    const isi = {
      nama: form.nama,
      email: form.email,
      divisi: form.divisi,
      ...(form.id ? {} : { password: form.password, ...(form.username.trim() ? { username: form.username.trim() } : {}) }),
      pembimbing_id: form.pembimbing_id || null,
    };
    try {
      if (form.id) {
        await api<{ pesan: string }>(`/admin/peserta/${form.id}`, { method: 'PUT', json: isi });
        toast('Data peserta disimpan.');
      } else {
        await api<{ pesan?: string }>('/admin/peserta', { method: 'POST', json: isi });
        toast('Peserta dibuat. Bagikan kata sandi awal kepada peserta, lalu minta dia menggantinya dari menu Profil.');
      }
      ubahForm(null);
      await muat();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  const toggling = async (b: BarisAdminUser) => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      await api(`/admin/peserta/${b.id}`, { method: 'PUT', json: { aktif: !b.aktif } });
      toast(b.aktif ? `${b.nama} dinonaktifkan.` : `${b.nama} diaktifkan kembali.`);
      await muat();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  const hapus = async (b: BarisAdminUser) => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      await api<{ pesan: string }>(`/admin/peserta/${b.id}`, { method: 'DELETE' });
      toast(`${b.nama} dihapus.`);
      await muat();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  const total = rows?.length ?? null;
  const aktif = rows?.filter((b) => b.aktif).length ?? null;
  const nonaktif = rows?.filter((b) => !b.aktif).length ?? null;

  return (
    <>
      <JudulHalaman
        eyebrow="Admin"
        judul="Kelola peserta"
        sub="Tambah, ubah, nonaktifkan, atau hapus data peserta PKL."
        aksi={
          form ? (
            <Tombol varian="gh" onClick={() => ubahForm(null)} disabled={sedang}>Tutup form</Tombol>
          ) : (
            <Tombol onClick={() => ubahForm({ ...kosong })}>
              <Ikon nama="plus" className="size-4" />
              Tambah peserta
            </Tombol>
          )
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Total peserta', nilai: total, warna: 'text-teks' },
          { label: 'Aktif', nilai: aktif, warna: 'text-g' },
          { label: 'Nonaktif', nilai: nonaktif, warna: 'text-mu' },
        ].map((s) => (
          <div key={s.label} className="rounded-kartu border border-garis bg-kartu p-3 shadow-kartu md:p-4">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[.6px] text-mu md:text-[10px]">{s.label}</p>
            <p className={`mt-1 text-2xl font-extrabold leading-none ${s.warna}`}>{s.nilai ?? '…'}</p>
          </div>
        ))}
      </div>

      <Kartu t="Daftar peserta">
        {galat ? <div className="mb-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}

        {form ? (
<<<<<<< Updated upstream
          <div className="mb-5 rounded-[14px] border border-[#c7dbff] bg-[#f8fbff] p-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-pr shadow-sm">
                <Ikon nama={form.id ? 'edit' : 'plus'} className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold">{form.id ? 'Edit peserta' : 'Tambah peserta'}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-mu">
                  {form.id
                    ? 'Kosongkan kolom yang tidak berubah untuk mempertahankan nilai lama.'
                    : 'Email boleh buatan admin; kata sandi awal dipakai peserta untuk login pertama.'}
                </p>
              </div>
=======
          <form onSubmit={simpan} className="mb-5 border-2 border-garis rounded-xl p-4 max-w-[560px]">
            <h3 className="font-bold text-sm mb-1">{form.id ? 'Edit peserta' : 'Tambah peserta'}</h3>
            <p className="text-mu text-sm mb-2">
              {form.id ? 'Kosongkan kolom yang tidak berubah untuk mempertahankan nilai lama.' : 'Email boleh buatan admin; kata sandi awal di bawah dipakai peserta untuk login pertama.'}
            </p>
            <Label htmlFor="psr_nama">Nama lengkap</Label>
            <input id="psr_nama" required maxLength={100} value={form.nama} onChange={(e) => ubahForm({ ...form, nama: e.target.value })}
              className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg" />
            <Label htmlFor="psr_email">Email</Label>
            <input id="psr_email" required type="email" maxLength={120} value={form.email} onChange={(e) => ubahForm({ ...form, email: e.target.value })}
              className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg" />
            {form.id ? null : (
              <>
                <Label htmlFor="psr_username">Username (opsional)</Label>
                <input id="psr_username" maxLength={50} value={form.username} onChange={(e) => ubahForm({ ...form, username: e.target.value })}
                  className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
                  placeholder="Kosongkan untuk memakai bagian depan email" />
              </>
            )}
            {form.id ? null : (
              <>
                <Label htmlFor="psr_sandi">Kata sandi awal</Label>
                <input
                  id="psr_sandi" required type="password" autoComplete="new-password" minLength={8} maxLength={72}
                  value={form.password} onChange={(e) => ubahForm({ ...form, password: e.target.value })}
                  className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
                />
                <small className="text-mu text-xs">Minimal 8 karakter, mengandung huruf dan angka. Peserta sebaiknya menggantinya setelah login pertama.</small>
              </>
            )}
            <Label htmlFor="psr_divisi">Divisi</Label>
            <input id="psr_divisi" maxLength={80} value={form.divisi} onChange={(e) => ubahForm({ ...form, divisi: e.target.value })}
              className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg" />
            <Label htmlFor="psr_pmb">Pembimbing</Label>
            <select id="psr_pmb" value={form.pembimbing_id} onChange={(e) => ubahForm({ ...form, pembimbing_id: e.target.value ? Number(e.target.value) : '' })}
              className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg">
              <option value="">— belum ditentukan —</option>
              {(() => {
                const opsi = [...pembimbing];
                if (form.pembimbing_id && !opsi.some((p) => p.id === form.pembimbing_id)) {
                  const lama = rows?.find((r) => r.id === form.id)?.peserta?.pembimbing;
                  opsi.unshift({ id: Number(form.pembimbing_id), nama: `${lama?.nama ?? 'Pembimbing saat ini'} (nonaktif)` });
                }
                return opsi.map((p) => (
                  <option key={p.id} value={p.id}>{p.nama}</option>
                ));
              })()}
            </select>
            <div className="flex gap-2 mt-4">
              <Tombol type="submit" disabled={sedang}>Simpan</Tombol>
              <Tombol varian="gh" onClick={() => ubahForm(null)} disabled={sedang}>Batal</Tombol>
>>>>>>> Stashed changes
            </div>
            <form onSubmit={simpan} className="max-w-[640px]">
              <div className="grid gap-x-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="psr_nama" className="mt-0">Nama lengkap</Label>
                  <Masukan id="psr_nama" required maxLength={100} value={form.nama} onChange={(e) => ubahForm({ ...form, nama: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="psr_email" className="mt-0">Email</Label>
                  <Masukan id="psr_email" required type="email" maxLength={120} value={form.email} onChange={(e) => ubahForm({ ...form, email: e.target.value })} />
                </div>
                {form.id ? null : (
                  <div className="sm:col-span-2">
                    <Label htmlFor="psr_sandi">Kata sandi awal</Label>
                    <Masukan
                      id="psr_sandi" required type="password" autoComplete="new-password" minLength={8} maxLength={72}
                      value={form.password} onChange={(e) => ubahForm({ ...form, password: e.target.value })}
                    />
                    <small className="mt-1 block text-[11px] text-mu">Minimal 8 karakter, mengandung huruf dan angka. Peserta sebaiknya menggantinya setelah login pertama.</small>
                  </div>
                )}
                <div>
                  <Label htmlFor="psr_divisi">Divisi</Label>
                  <Masukan id="psr_divisi" maxLength={80} value={form.divisi} onChange={(e) => ubahForm({ ...form, divisi: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="psr_pmb">Pembimbing</Label>
                  <select
                    id="psr_pmb"
                    value={form.pembimbing_id}
                    onChange={(e) => ubahForm({ ...form, pembimbing_id: e.target.value ? Number(e.target.value) : '' })}
                    className="mt-1 block h-[38px] w-full rounded-lg border border-garis bg-bg px-[11px] text-sm outline-none focus:border-pr focus:ring-4 focus:ring-pr/10"
                  >
                    <option value="">— belum ditentukan —</option>
                    {pembimbing.map((p) => (
                      <option key={p.id} value={p.id}>{p.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Tombol type="submit" disabled={sedang}>
                  <Ikon nama="check" className="size-4" />
                  Simpan
                </Tombol>
                <Tombol varian="gh" onClick={() => ubahForm(null)} disabled={sedang}>Batal</Tombol>
              </div>
            </form>
          </div>
        ) : null}

        <FxDaftar
          rows={rows}
          em="Belum ada peserta terdaftar."
          kolom={[
            {
              t: 'Nama',
              isi: (b) => (
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pl text-[11px] font-extrabold text-pr">
                    {b.nama.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <b className="block leading-tight">{b.nama}</b>
                    {!b.aktif ? <span className="mt-1 inline-block"><Badge s="Nonaktif" /></span> : null}
                  </span>
                </span>
              ),
            },
            { t: 'Email', isi: (b) => <span className="text-mu">{b.email}</span> },
            { t: 'Divisi', isi: (b) => b.peserta?.divisi || '-' },
            { t: 'Pembimbing', isi: (b) => b.peserta?.pembimbing?.nama || '-' },
            {
              t: 'Aksi',
              isi: (b) => (
                <span className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      ubahForm({
                        id: b.id, nama: b.nama, username: b.username ?? '', email: b.email, password: '', divisi: b.peserta?.divisi ?? '',
                        pembimbing_id: b.peserta?.pembimbing_id ?? '',
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2 py-1 text-[11px] font-bold text-pr transition hover:border-pr hover:bg-pl"
                  >
                    <Ikon nama="edit" className="size-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => void toggling(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2 py-1 text-[11px] font-bold text-y transition hover:border-y/50 hover:bg-[#a1620712]"
                  >
                    <Ikon nama={b.aktif ? 'x' : 'check'} className="size-3" />
                    {b.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => void hapus(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2 py-1 text-[11px] font-bold text-r transition hover:border-r/40 hover:bg-[#b91c1c0d]"
                  >
                    <Ikon nama="x" className="size-3" />
                    Hapus
                  </button>
                </span>
              ),
            },
          ]}
        />
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-mu">
          <Ikon nama="info" className="mt-0.5 size-3.5 shrink-0" />
          Hapus hanya untuk data yang belum dipakai sama sekali (tanpa riwayat absensi/jurnal).
          Peserta yang sudah aktif sebaiknya cukup dinonaktifkan agar riwayat tetap utuh.
        </p>
      </Kartu>
    </>
  );
}
