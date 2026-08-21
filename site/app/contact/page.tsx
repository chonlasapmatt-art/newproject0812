import type { Metadata } from 'next';
import { ContactPage } from '../../components/contact-page';

export const metadata: Metadata = {
  title: 'ติดต่อเรา | ImJai Cafe & Kitchen',
  description: 'ทักไลน์ โทรหาร้าน หรือแวะมาที่ร้าน — ช่องทางติดต่ออิ่มใจ คาเฟ่ & ครัว',
};

export default function Page() {
  return <ContactPage />;
}
