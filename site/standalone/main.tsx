/**
 * Entry point for the single-file build.
 *
 * Mirrors what app/layout.tsx and the app/**\/page.tsx files do on the server:
 * wrap everything in SiteShell, then render the component for the current
 * route. The page components themselves are imported unchanged.
 */

import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { SiteShell } from '../components/site-shell';
import { HomePage } from '../components/home-page';
import { MenuBrowser } from '../components/menu-browser';
import { CheckoutPage } from '../components/checkout-page';
import { TrackPage } from '../components/track-page';
import { AccountPage } from '../components/account-page';
import { AdminDashboard } from '../components/admin-dashboard';
import { useRoute } from './router';

import '../app/globals.css';

const Loading = () => (
  <main className="page-loading" aria-label="กำลังโหลด">
    <span />
    <span />
    <span />
  </main>
);

const ROUTES: Record<string, () => React.ReactElement> = {
  '/': () => <HomePage />,
  '/menu': () => (
    <Suspense fallback={<Loading />}>
      <MenuBrowser />
    </Suspense>
  ),
  '/checkout': () => <CheckoutPage />,
  '/track': () => (
    <Suspense fallback={<Loading />}>
      <TrackPage />
    </Suspense>
  ),
  '/account': () => <AccountPage />,
  '/admin': () => <AdminDashboard />,
};

function NotFound({ path }: { path: string }) {
  return (
    <main className="checkout-empty">
      <span>🍽️</span>
      <h1>ไม่พบหน้านี้</h1>
      <p>
        ไม่มีหน้า <code>{path}</code> ในเว็บไซต์
      </p>
      <a className="primary-button" href="#/">
        กลับหน้าแรก
      </a>
    </main>
  );
}

function App() {
  const { path } = useRoute();
  const render = ROUTES[path];
  return <SiteShell>{render ? render() : <NotFound path={path} />}</SiteShell>;
}

// The stylesheet hides reveal-animated content until the bundle boots; this is
// the same guard app/layout.tsx inlines in <head>.
document.documentElement.classList.remove('no-js');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
