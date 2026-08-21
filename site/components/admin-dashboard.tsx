'use client';

import type { User } from '@supabase/supabase-js';
import { BarChart3, ChefHat, ClipboardList, LockKeyhole, Package, Settings, ShieldAlert, TicketPercent, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MENU_ITEMS } from '../lib/catalog';
import { supabase } from '../lib/supabase';

export function AdminDashboard() {
  const [checking, setChecking] = useState(Boolean(supabase));
  const [user, setUser] = useState<User | null>(null);
  const preview = process.env.NEXT_PUBLIC_ADMIN_PREVIEW_MODE === 'true';
  useEffect(() => { if (!supabase) return; supabase.auth.getUser().then(({ data }) => { setUser(data.user); setChecking(false); }); }, []);
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role;
  const allowed = preview || role === 'admin' || role === 'staff';
  if (checking) return <main className="admin-lock"><span className="loading-ring" /><p>กำลังตรวจสอบสิทธิ์…</p></main>;
  if (!allowed) return <main className="admin-lock"><span><LockKeyhole /></span><h1>สำหรับทีมงานอิ่มใจ</h1><p>หน้านี้อนุญาตเฉพาะบัญชี staff และ admin เท่านั้น สิทธิ์ถูกตรวจจากระบบหลังบ้าน ไม่สามารถเปลี่ยนจากหน้าเว็บได้</p><Link prefetch={false} className="primary-button" href="/account">เข้าสู่ระบบพนักงาน</Link><small><ShieldAlert /> หากคิดว่าควรเข้าถึงได้ กรุณาติดต่อผู้ดูแลระบบ</small></main>;
  return <main className="admin-page"><aside className="admin-sidebar"><Link className="brand" href="/"><span className="brand-mark">อ</span><span><b>IMJAI</b><small>STORE ADMIN</small></span></Link><nav><a className="active"><BarChart3 /> ภาพรวม</a><a><ClipboardList /> ออเดอร์</a><a><ChefHat /> เมนูและสต็อก</a><a><TicketPercent /> โปรโมชัน</a><a><Users /> สมาชิก</a><a><Settings /> ตั้งค่าร้าน</a></nav><div className="admin-user"><span>{user?.email?.slice(0, 1).toUpperCase() ?? 'A'}</span><div><b>{user?.email ?? 'Admin Preview'}</b><small>{role ?? 'admin'}</small></div></div></aside><section className="admin-content"><header><div><p className="eyebrow">FRIDAY, 21 AUG 2026</p><h1>ภาพรวมร้านวันนี้</h1></div><button><Settings /> ตั้งค่าร้าน</button></header><div className="metric-grid"><article><span><TrendingUp /></span><div><small>รายได้วันนี้</small><h2>฿12,480</h2><p>↑ 14% จากเมื่อวาน</p></div></article><article><span><ClipboardList /></span><div><small>ออเดอร์ทั้งหมด</small><h2>42</h2><p>6 ออเดอร์ใหม่</p></div></article><article><span><ChefHat /></span><div><small>กำลังเตรียม</small><h2>8</h2><p>เฉลี่ย 18 นาที</p></div></article><article><span><Package /></span><div><small>เมนูใกล้หมด</small><h2>3</h2><p>ตรวจสต็อกทันที</p></div></article></div><div className="admin-panels"><article className="orders-panel"><div className="panel-title"><div><h2>ออเดอร์ล่าสุด</h2><p>อัปเดตสถานะจากหน้าครัว</p></div><button>ดูทั้งหมด</button></div><div className="admin-table"><div className="table-head"><span>ออเดอร์</span><span>ลูกค้า</span><span>ยอดรวม</span><span>สถานะ</span></div>{[['IJ260821-A1C9','คุณมิน','฿249','ออเดอร์ใหม่'],['IJ260821-B7K2','คุณต้น','฿385','กำลังปรุง'],['IJ260821-C3M8','คุณแพรว','฿155','พร้อมรับ'],['IJ260821-D4P1','คุณนนท์','฿299','กำลังจัดส่ง']].map((row) => <div className="table-row" key={row[0]}>{row.map((cell, index) => <span className={index === 3 ? `status-${index}` : ''} key={cell}>{cell}</span>)}</div>)}</div></article><article className="stock-panel"><div className="panel-title"><div><h2>สต็อกเมนู</h2><p>รายการที่ควรตรวจสอบ</p></div></div>{MENU_ITEMS.filter((item) => item.stock <= 10).slice(0, 5).map((item) => <div className="stock-row" key={item.sku}><span>{item.emoji}</span><div><b>{item.name}</b><small>{item.sku}</small></div><em className={!item.stock ? 'empty' : ''}>{item.stock ? `เหลือ ${item.stock}` : 'หมด'}</em></div>)}</article></div></section></main>;
}
