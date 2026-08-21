import type { Metadata } from 'next';
import { AdminDashboard } from '../../components/admin-dashboard';

export const metadata: Metadata = { title: 'ระบบจัดการร้าน | ImJai Cafe & Kitchen', robots: { index: false, follow: false } };
export default function Page() { return <AdminDashboard />; }
