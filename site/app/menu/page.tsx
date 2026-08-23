import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MenuBrowser } from '../../components/menu-browser';

export const metadata: Metadata = { title: 'เมนู | ImJai Cafe & Kitchen', description: 'เลือกอาหาร กาแฟ เครื่องดื่ม และเบเกอรี่จากร้านอิ่มใจ' };

// Shaped like the page it stands in for — hero, toolbar, then a card grid —
// so the loading moment reads as "the menu is arriving" rather than a
// generic block that could belong to any page on the site.
function MenuSkeleton() {
  return (
    <main className="page-loading menu-skeleton" aria-label="กำลังโหลดเมนู">
      <div className="skeleton-hero" />
      <div className="skeleton-toolbar" />
      <div className="skeleton-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <span className="skeleton-art" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ))}
      </div>
    </main>
  );
}

export default function MenuPage() { return <Suspense fallback={<MenuSkeleton />}><MenuBrowser /></Suspense>; }
