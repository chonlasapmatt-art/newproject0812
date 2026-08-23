import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountPage } from '../../components/account-page';

export const metadata: Metadata = {
  title: 'สมาชิก | ImJai Cafe & Kitchen',
  description: 'เข้าสู่ระบบ สมัครสมาชิก จัดการที่อยู่ และดูประวัติออเดอร์',
};

// Shaped like the sign-in card it stands in for, so the loading moment
// doesn't flash a layout the page never actually uses.
function AccountSkeleton() {
  return (
    <main className="page-loading account-skeleton" aria-label="กำลังโหลดหน้าสมาชิก">
      <div className="skeleton-auth-card">
        <span className="skeleton-line title" />
        <span className="skeleton-field" />
        <span className="skeleton-field" />
        <span className="skeleton-button" />
      </div>
    </main>
  );
}

export default function Page() {
  // The page reads ?next= to send someone back where they were, and
  // useSearchParams has no value to give while prerendering — without this
  // boundary the static export fails on this route rather than at runtime.
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountPage />
    </Suspense>
  );
}
