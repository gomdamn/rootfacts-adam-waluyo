import '../styles/styles.css';
import App from './pages/app.js';

async function registerServiceWorker() {
  const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

  // Di localhost service worker dimatikan agar tidak memakai cache versi lama saat debugging.
  if (isLocalhost) {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    console.info('Service Worker disabled on localhost. It will be active on Netlify.');
    return;
  }

  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
    console.info('Service Worker registered.');
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
  }
}

function renderFatalError(error) {
  const main = document.querySelector('#main-content');
  const statusText = document.querySelector('#status-text');
  if (statusText) statusText.textContent = 'Error aplikasi';
  if (main) {
    main.innerHTML = `
      <section class="result-card idle-card" style="margin:1rem;">
        <h2>Aplikasi gagal dimuat</h2>
        <p>Silakan buka DevTools Console untuk detail error. Pesan utama: ${String(error?.message || error)}</p>
      </section>
    `;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new App({
      container: document.querySelector('#main-content'),
    });

    await app.renderPage();
    await registerServiceWorker();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error('RootFacts boot error:', error);
    renderFatalError(error);
  }
});
