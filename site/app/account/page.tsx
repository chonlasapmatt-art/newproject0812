import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountPage } from '../../components/account-page';

export const metadata: Metadata = {
  title: 'สมาชิก | ImJai Cafe & Kitchen',
  description: 'เข้าสู่ระบบ สมัครสมาชิก จัดการที่อยู่ และดูประวัติออเดอร์',
};

export default function Page() {
  // The page reads ?next= to send someone back where they were, and
  // useSearchParams has no value to give while prerendering — without this
  // boundary the static export fails on this route rather than at runtime.
  return (
    <Suspense
      fallback={
        <main className="page-loading" aria-label="กำลังโหลดหน้าสมาชิก">
          <span /><span /><span />
        </main>
      }
    >
      <AccountPage />
    </Suspense>
  );
}
