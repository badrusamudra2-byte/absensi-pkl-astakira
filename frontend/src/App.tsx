import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './konteks/Auth';
import { ToastProvider } from './komponen/Toast';
import { BelumMasukGuard, SudahMasukGuard, GuardPeran } from './komponen/Guard';
import Shell from './komponen/Shell';

/** Fallback selama potongan halaman dimuat — teks ringan seirama gaya halaman. */
const Fallback = () => (
  <div className="py-16 text-center text-mu text-sm" role="status" aria-live="polite">
    Memuat halaman&hellip;
  </div>
);

/** Bungkus komponen yang dimuat malas dengan Suspense agar fallback tampil bila potongan belum ada. */
const malas = (C: ComponentType): ReactNode => (
  <Suspense fallback={<Fallback />}>
    <C />
  </Suspense>
);

/* Publik */
const Login = lazy(() => import('./pages/Login'));
const LupaSandi = lazy(() => import('./pages/LupaSandi'));
const AturUlang = lazy(() => import('./pages/AturUlang'));

/* Peserta */
const BerandaPeserta = lazy(() => import('./pages/Beranda'));
const Profil = lazy(() => import('./pages/Profil'));
const Absensi = lazy(() => import('./pages/peserta/Absensi'));
const TayangQr = lazy(() => import('./pages/peserta/TayangQr'));
const Riwayat = lazy(() => import('./pages/peserta/Riwayat'));
const WajahDaftar = lazy(() => import('./pages/peserta/WajahDaftar'));
const WajahPeriksa = lazy(() => import('./pages/peserta/WajahPeriksa'));
const JurnalList = lazy(() => import('./pages/peserta/JurnalList'));
const JurnalForm = lazy(() => import('./pages/peserta/JurnalForm'));
const JurnalDetail = lazy(() => import('./pages/peserta/JurnalDetail'));
const PengajuanIzin = lazy(() => import('./pages/peserta/PengajuanIzin'));

/* Pembimbing */
const DashboardPembimbing = lazy(() => import('./pages/pembimbing/Dashboard'));
const Scan = lazy(() => import('./pages/pembimbing/Scan'));
const PesertaPembimbing = lazy(() => import('./pages/pembimbing/Peserta'));
const JurnalReview = lazy(() => import('./pages/pembimbing/Jurnal'));
const DetailJurnalPmb = lazy(() => import('./pages/pembimbing/DetailJurnal'));
const Rekap = lazy(() => import('./pages/pembimbing/Rekap'));
const IzinPmb = lazy(() => import('./pages/pembimbing/Izin'));

/* Admin */
const DashboardAdmin = lazy(() => import('./pages/admin/Dashboard'));
const PesertaAdmin = lazy(() => import('./pages/admin/Peserta'));
const PembimbingAdmin = lazy(() => import('./pages/admin/Pembimbing'));
const Jadwal = lazy(() => import('./pages/admin/Jadwal'));
const AbsensiAdmin = lazy(() => import('./pages/admin/Absensi'));
const Audit = lazy(() => import('./pages/admin/Audit'));
const Pengaturan = lazy(() => import('./pages/admin/Pengaturan'));

/** Beranda sesuai peran: dashboard ringkasan untuk pembimbing dan admin. */
function BerandaPeran() {
  const { user } = useAuth();
  if (user?.role === 'pembimbing') return malas(DashboardPembimbing);
  if (user?.role === 'admin') return malas(DashboardAdmin);
  return malas(BerandaPeserta);
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<Fallback />}>
            <Routes>
              {/* Publik */}
              <Route
                path="/login"
                element={
                  <SudahMasukGuard>
                    <Login />
                  </SudahMasukGuard>
                }
              />
              <Route path="/lupa-sandi" element={<LupaSandi />} />
              <Route path="/reset-password" element={<AturUlang />} />

              {/* Terlindungi: tata letak + halaman per peran */}
              <Route
                element={
                  <BelumMasukGuard>
                    <Shell />
                  </BelumMasukGuard>
                }
              >
                <Route path="/" element={<GuardPeran><BerandaPeran /></GuardPeran>} />
                <Route path="/profil" element={<GuardPeran><Profil /></GuardPeran>} />

                {/* Fasilitas peserta */}
                <Route path="/absensi" element={<GuardPeran role="peserta"><Absensi /></GuardPeran>} />
                <Route path="/absensi/qr" element={<GuardPeran role="peserta"><TayangQr /></GuardPeran>} />
                <Route path="/riwayat" element={<GuardPeran role="peserta"><Riwayat /></GuardPeran>} />
                <Route path="/wajah/daftar" element={<GuardPeran role="peserta"><WajahDaftar /></GuardPeran>} />
                <Route path="/wajah/periksa" element={<GuardPeran role="peserta"><WajahPeriksa /></GuardPeran>} />
                <Route path="/jurnal" element={<GuardPeran role="peserta"><JurnalList /></GuardPeran>} />
                <Route path="/jurnal/baru" element={<GuardPeran role="peserta"><JurnalForm /></GuardPeran>} />
                <Route path="/jurnal/:id" element={<GuardPeran role="peserta"><JurnalDetail /></GuardPeran>} />
                <Route path="/jurnal/:id/edit" element={<GuardPeran role="peserta"><JurnalForm /></GuardPeran>} />
                <Route path="/pengajuan" element={<GuardPeran role="peserta"><PengajuanIzin /></GuardPeran>} />

                {/* Fasilitas pembimbing */}
                <Route path="/pembimbing/scan" element={<GuardPeran role="pembimbing"><Scan /></GuardPeran>} />
                <Route path="/pembimbing/peserta" element={<GuardPeran role="pembimbing"><PesertaPembimbing /></GuardPeran>} />
                <Route path="/pembimbing/jurnal" element={<GuardPeran role="pembimbing"><JurnalReview /></GuardPeran>} />
                <Route path="/pembimbing/jurnal/:id" element={<GuardPeran role="pembimbing"><DetailJurnalPmb /></GuardPeran>} />
                <Route path="/pembimbing/rekap" element={<GuardPeran role="pembimbing"><Rekap /></GuardPeran>} />
                <Route path="/pembimbing/izin" element={<GuardPeran role="pembimbing"><IzinPmb /></GuardPeran>} />

                {/* Fasilitas admin */}
                <Route path="/admin/peserta" element={<GuardPeran role="admin"><PesertaAdmin /></GuardPeran>} />
                <Route path="/admin/pembimbing" element={<GuardPeran role="admin"><PembimbingAdmin /></GuardPeran>} />
                <Route path="/admin/jadwal" element={<GuardPeran role="admin"><Jadwal /></GuardPeran>} />
                <Route path="/admin/absensi" element={<GuardPeran role="admin"><AbsensiAdmin /></GuardPeran>} />
                <Route path="/admin/audit" element={<GuardPeran role="admin"><Audit /></GuardPeran>} />
                <Route path="/pengaturan" element={<GuardPeran role="admin"><Pengaturan /></GuardPeran>} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
