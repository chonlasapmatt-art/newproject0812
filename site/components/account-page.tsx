'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from '@supabase/supabase-js';
import { Eye, EyeOff, LogOut, MapPin, Package, RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useCartStore } from '../stores/cart-store';

const authSchema = z.object({ email: z.string().email('กรุณากรอกอีเมลให้ถูกต้อง'), password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'), name: z.string().optional() });
type AuthValues = z.infer<typeof authSchema>;
type Mode = 'login' | 'register' | 'forgot';

export function AccountPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const cartLines = useCartStore((state) => state.lines);
  const { register, handleSubmit, formState: { errors } } = useForm<AuthValues>({ resolver: zodResolver(authSchema) });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (values: AuthValues) => {
    setMessage('');
    if (!isSupabaseConfigured || !supabase) { setMessage('ระบบสมาชิกพร้อมใช้งานหลังเจ้าของร้านเชื่อมต่อ Supabase ตามคู่มือในโปรเจกต์'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo: `${location.origin}/account` });
        if (error) throw error; setMessage('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว');
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email: values.email, password: values.password, options: { data: { full_name: values.name?.trim() } } });
        if (error) throw error; setMessage('สมัครแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชี');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
        if (error) throw error;
        if (cartLines.length && data.user) await supabase.rpc('merge_guest_cart', { p_items: cartLines.map((line) => ({ sku: line.sku, quantity: line.quantity, options: line.options ?? [], add_ons: line.addOns ?? [], note: line.note ?? '' })) });
      }
    } catch { setMessage('ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง'); }
    finally { setBusy(false); }
  };

  const logout = async () => { if (supabase) await supabase.auth.signOut(); setMessage('ออกจากระบบเรียบร้อย'); window.setTimeout(() => location.assign('/'), 450); };

  if (user) return <MemberDashboard user={user} logout={logout} />;
  return <main className="account-page"><section className="account-art"><div><span className="account-emblem">อ</span><p className="eyebrow">IMJAI MEMBER</p><h1>ยิ่งแวะมา<br />ยิ่งรู้ใจ</h1><p>เก็บที่อยู่ ดูประวัติ ติดตามออเดอร์ และสั่งเมนูเดิมซ้ำได้ง่ายกว่าเดิม</p></div><div className="account-benefits"><span><Package /> ดูออเดอร์ทั้งหมดในที่เดียว</span><span><MapPin /> บันทึกที่อยู่ได้หลายรายการ</span><span><RotateCcw /> สั่งเมนูโปรดซ้ำในคลิกเดียว</span></div></section><section className="auth-card"><p className="eyebrow">WELCOME TO IMJAI</p><h2>{mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครสมาชิก' : 'ลืมรหัสผ่าน'}</h2><p>{mode === 'login' ? 'กลับมาสั่งเมนูโปรดกันค่ะ' : mode === 'register' ? 'สมัครฟรี ใช้เวลาไม่ถึงหนึ่งนาที' : 'เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้'}</p><div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>เข้าสู่ระบบ</button><button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>สมัครสมาชิก</button></div><form onSubmit={handleSubmit(submit)}>{mode === 'register' && <label>ชื่อที่ใช้เรียก<input {...register('name')} autoComplete="name" placeholder="ชื่อของคุณ" /></label>}<label>อีเมล<input {...register('email')} type="email" autoComplete="email" placeholder="you@example.com" />{errors.email && <small>{errors.email.message}</small>}</label>{mode !== 'forgot' && <label>รหัสผ่าน<div className="password-field"><input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="อย่างน้อย 8 ตัวอักษร" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>{errors.password && <small>{errors.password.message}</small>}</label>}{mode === 'login' && <button className="forgot-link" type="button" onClick={() => setMode('forgot')}>ลืมรหัสผ่าน?</button>}<button className="auth-submit" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สร้างบัญชี' : 'ส่งลิงก์รีเซ็ต'}</button>{message && <p className="form-message" role="status">{message}</p>}</form><div className="auth-security"><ShieldCheck /> ข้อมูลสมาชิกถูกป้องกันด้วย Supabase Auth และ Row Level Security</div></section></main>;
}

function MemberDashboard({ user, logout }: { user: User; logout: () => void }) {
  return <main className="member-page"><section className="member-head"><div className="member-avatar"><UserRound /></div><div><p>สวัสดีค่ะ</p><h1>{user.user_metadata?.full_name || user.email}</h1><span>สมาชิกอิ่มใจ · customer</span></div><button onClick={logout}><LogOut /> ออกจากระบบ</button></section><section className="member-grid"><article><h2>ข้อมูลส่วนตัว</h2><label>ชื่อ<input defaultValue={user.user_metadata?.full_name ?? ''} /></label><label>เบอร์โทร<input defaultValue={user.user_metadata?.phone ?? ''} /></label><button className="secondary-button">บันทึกข้อมูล</button></article><article><h2>ที่อยู่จัดส่ง</h2><div className="saved-address"><MapPin /><div><b>ยังไม่มีที่อยู่</b><span>เพิ่มที่อยู่เพื่อชำระเงินได้เร็วขึ้น</span></div></div><button className="secondary-button">+ เพิ่มที่อยู่</button></article><article className="member-orders"><h2>ออเดอร์ล่าสุด</h2><div className="empty-member-data"><Package /><span>ยังไม่มีประวัติออเดอร์</span></div></article></section></main>;
}
