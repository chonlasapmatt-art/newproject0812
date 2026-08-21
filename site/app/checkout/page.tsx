import type { Metadata } from 'next';
import { CheckoutPage } from '../../components/checkout-page';

export const metadata: Metadata = { title: 'ชำระเงิน | ImJai Cafe & Kitchen', description: 'ยืนยันรายการ เลือกรับที่ร้านหรือจัดส่ง และส่งคำสั่งซื้ออย่างปลอดภัย' };
export default function Page() { return <CheckoutPage />; }
