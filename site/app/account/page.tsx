import type { Metadata } from 'next';
import { AccountPage } from '../../components/account-page';

export const metadata: Metadata = { title: 'สมาชิก | ImJai Cafe & Kitchen', description: 'เข้าสู่ระบบ สมัครสมาชิก จัดการที่อยู่ และดูประวัติออเดอร์' };
export default function Page() { return <AccountPage />; }
