import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('app')!).render(<App />);

// PWA: daftarkan service worker hanya saat produksi (kolaborasi cache dev Vite tidak perlu)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW gagal daftar: aplikasi tetap berjalan normal tanpa dukungan luring */
    });
  });
}
