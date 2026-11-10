import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisAdminUser } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Label, Badge } from '../../komponen/ui';
import { FxDaftar } from '../../komponen/umum';
import { useToast } from '../../komponen/Toast';

interface FormNilai {
  id?: number;
  nama: string;
  email: string;
  password: string;
  divisi: string;
  pembimbing_id: number | '';
}

const kosong: FormNilai = { nama: '', email: '', password: '', divisi: '', pembimbing_id: '' };

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
      nama: form.nama, email: form.email, divisi: form.divisi,
      ...(form.id ? {} : { password: form.password }),
      ...(form.pembimbing_id ? { pembimbing_id: form.pembimbing_id } : {}),
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

  return (
    <>
      <Kartu t="Kelola peserta">
        {galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
        {form ? (
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
              {pembimbing.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
            <div className="flex gap-2 mt-4">
              <Tombol type="submit" disabled={sedang}>Simpan</Tombol>
              <Tombol varian="gh" onClick={() => ubahForm(null)} disabled={sedang}>Batal</Tombol>
            </div>
          </form>
        ) : (
          <p className="mb-4"><Tombol onClick={() => ubahForm({ ...kosong })}>Tambah peserta</Tombol></p>
        )}

        <FxDaftar
          rows={rows}
          kolom={[
            {
              t: 'Nama',
              isi: (b) => (
                <b>
                  {b.nama}
                  {!b.aktif ? <Badge s="Nonaktif" /> : null}
                </b>
              ),
            },
            { t: 'Email', isi: (b) => b.email },
            { t: 'Divisi', isi: (b) => b.peserta?.divisi || '-' },
            { t: 'Pembimbing', isi: (b) => b.peserta?.pembimbing?.nama || '-' },
            {
              t: 'Aksi',
              isi: (b) => (
                <span className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      ubahForm({
                        id: b.id, nama: b.nama, email: b.email, password: '', divisi: b.peserta?.divisi ?? '',
                        pembimbing_id: b.peserta?.pembimbing_id ?? '',
                      })
                    }
                    className="text-pr underline text-sm cursor-pointer bg-transparent border-0 p-0"
                  >
                    Edit
                  </button>
                  <button onClick={() => void toggling(b)} className="text-y underline text-sm cursor-pointer bg-transparent border-0 p-0">
                    {b.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => void hapus(b)} className="text-r underline text-sm cursor-pointer bg-transparent border-0 p-0">
                    Hapus
                  </button>
                </span>
              ),
            },
          ]}
        />
        <p className="text-xs text-mu mt-3">
          Hapus hanya untuk data yang belum dipakai sama sekali (tanpa riwayat absensi/jurnal).
          Peserta yang sudah aktif sebaiknya cukup dinonaktifkan agar riwayat tetap utuh.
        </p>
      </Kartu>
    </>
  );
}
