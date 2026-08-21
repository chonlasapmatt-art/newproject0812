import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackPage } from '../../components/track-page';

export const metadata: Metadata = { title: 'ติดตามออเดอร์ | ImJai Cafe & Kitchen', description: 'ตรวจสถานะออเดอร์อิ่มใจแบบเรียลไทม์' };
export default function Page() { return <Suspense fallback={<main className="page-loading" aria-label="กำลังโหลดสถานะออเดอร์"><span /><span /><span /></main>}><TrackPage /></Suspense>; }
