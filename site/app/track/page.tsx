import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackPage } from '../../components/track-page';

export const metadata: Metadata = { title: 'ติดตามออเดอร์ | ImJai Cafe & Kitchen', description: 'ตรวจสถานะออเดอร์อิ่มใจแบบเรียลไทม์' };

// Shaped like the search row and the tracking card underneath it, rather
// than a generic block — the actual layout appears the instant data does.
function TrackSkeleton() {
  return (
    <main className="page-loading track-skeleton" aria-label="กำลังโหลดสถานะออเดอร์">
      <div className="skeleton-hero" />
      <div className="skeleton-search-row" />
      <div className="skeleton-tracking-card">
        <span className="skeleton-line title" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </main>
  );
}

export default function Page() { return <Suspense fallback={<TrackSkeleton />}><TrackPage /></Suspense>; }
