import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MenuBrowser } from '../../components/menu-browser';

export const metadata: Metadata = { title: 'เมนู | ImJai Cafe & Kitchen', description: 'เลือกอาหาร กาแฟ เครื่องดื่ม และเบเกอรี่จากร้านอิ่มใจ' };

export default function MenuPage() { return <Suspense fallback={<main className="page-loading" aria-label="กำลังโหลดเมนู"><span /><span /><span /></main>}><MenuBrowser /></Suspense>; }
