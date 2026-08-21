import type { Metadata } from 'next';
import { AboutPage } from '../../components/about-page';

export const metadata: Metadata = {
  title: 'เกี่ยวกับเรา | ImJai Cafe & Kitchen',
  description: 'ที่ตั้งร้าน เวลาทำการ ค่าจัดส่ง และเรื่องราวของอิ่มใจ คาเฟ่ & ครัว',
};

export default function Page() {
  return <AboutPage />;
}
