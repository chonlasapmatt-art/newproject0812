import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LineLinkPage } from '../../../components/line-link-page';

export const metadata: Metadata = {
  title: 'เชื่อม LINE | ImJai Cafe & Kitchen',
  description: 'เชื่อมสมาชิกเว็บกับ LINE OA เพื่อติดตามออเดอร์อย่างปลอดภัย',
};

export default function Page() {
  return <Suspense fallback={<main className="page-loading" aria-label="กำลังโหลด" />}>
    <LineLinkPage />
  </Suspense>;
}
