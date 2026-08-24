'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff, Link2, LogOut, MapPin, Package, RotateCcw, ShieldCheck, Unlink, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { claimPendingAdd } from '../lib/add-to-cart';
import { rise, settle } from '../lib/motion';
import { previewSignIn, useSession, useSignOut, type SessionUser } from '../lib/session';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getLineAccountState, unlinkLineAccount, type LineAccountState } from '../lib/line-account';
import { SITE_URL, safeNextPath } from '../lib/site';
import { showToast } from '../lib/toast';
import { ordersForAccount, useOrders, type StoredOrder } from '../lib/orders';
import { useCartStore } from '../stores/cart-store';
import { LineButton } from './line-button';

const authSchema = z.object({ email: z.string().email('กรุณากรอกอีเมลให้ถูกต้อง'), password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'), name: z.string().optional() });
type AuthValues = z.infer<typeof authSchema>;
type Mode = 'login' | 'register' | 'forgot';

export function AccountPage() {
  const session = useSession();
  const user = session.user;
  const signOut = useSignOut();
  const router = useRouter();
  const params = useSearchParams();

  // Whoever arrived here mid-order gets taken back to where they were, with
  // the dish they tapped already in the basket. Signing in should feel like a
  // step in the order, not a detour that cost them their choice.
  const addLine = useCartStore((state) => state.add);
  useEffect(() => {
    if (session.status !== 'signed-in') return;
    const pending = claimPendingAdd();
    if (pending) {
      addLine(pending.line);
      showToast(`เพิ่ม${pending.line.name}ลงตะกร้าแล้ว`, 'success');
    }
    const next = params.get('next');
    if (next?.startsWith('/')) router.replace(next);
  }, [session.status, params, router, addLine]);

  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const cartLines = useCartStore((state) => state.lines);
  const orders = useOrders();
  const myOrders = ordersForAccount(orders, user?.email, user?.id).slice(0, 6);
  const { register, handleSubmit, formState: { errors } } = useForm<AuthValues>({ resolver: zodResolver(authSchema) });


  const submit = async (values: AuthValues) => {
    setMessage('');
    // Without a Supabase project there is nothing to authenticate against, so
    // sign in locally instead of refusing. The session it creates is marked
    // unverified and no server will accept it — it exists so the shop can walk
    // the whole flow, admin views included, while the backend is being set up.
    if (!isSupabaseConfigured || !supabase) {
      if (mode === 'forgot') { setMessage('รีเซ็ตรหัสผ่านได้หลังเชื่อมต่อ Supabase แล้ว'); return; }
      const session = previewSignIn(values.email, values.name);
      setMessage(session.role === 'admin'
        ? 'เข้าสู่ระบบโหมดพรีวิวแล้ว — คุณเห็นแดชบอร์ดได้'
        : 'เข้าสู่ระบบโหมดพรีวิวแล้ว — ข้อมูลจะยังไม่ถูกบันทึกจนกว่าจะเชื่อม Supabase');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo: `${SITE_URL}/account/` });
        if (error) throw error; setMessage('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว');
      } else if (mode === 'register') {
        // Preserve wherever this signup started (most often the LINE-linking
        // page) across the email round trip, so confirming doesn't strand the
        // customer back at square one. With nothing to return to, land on the
        // home page rather than the bare account page.
        const { error } = await supabase.auth.signUp({ email: values.email, password: values.password, options: { data: { full_name: values.name?.trim() }, emailRedirectTo: `${SITE_URL}${safeNextPath(params.get('next'))}` } });
        if (error) throw error; setMessage('สมัครแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชี');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
        if (error) throw error;
        if (cartLines.length && data.user) await supabase.rpc('merge_guest_cart', { p_items: cartLines.map((line) => ({ sku: line.sku, quantity: line.quantity, options: line.options ?? [], add_ons: line.addOns ?? [], note: line.note ?? '' })) });
      }
    } catch { setMessage('ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง'); }
    finally { setBusy(false); }
  };

  const logout = async () => { await signOut(); setMessage('ออกจากระบบเรียบร้อย'); window.setTimeout(() => router.push('/'), 450); };

  return <AnimatePresence mode="wait">{user ? (
    <MemberDashboard key="member" user={user} orders={myOrders} logout={logout} />
  ) : (
    <motion.main className="account-page" key="guest" {...settle} exit={{ opacity: 0, y: 12, scale: 0.99, transition: { duration: 0.18 } }}><section className="account-art"><div><span className="account-emblem">อ</span><p className="eyebrow">IMJAI MEMBER</p><h1>ยิ่งแวะมา<br />ยิ่งรู้ใจ</h1><p>เก็บที่อยู่ ดูประวัติ ติดตามออเดอร์ และสั่งเมนูเดิมซ้ำได้ง่ายกว่าเดิม</p></div><div className="account-benefits"><span><Package /> ดูออเดอร์ทั้งหมดในที่เดียว</span><span><MapPin /> บันทึกที่อยู่ได้หลายรายการ</span><span><RotateCcw /> สั่งเมนูโปรดซ้ำในคลิกเดียว</span></div></section><section className="auth-card"><p className="eyebrow">WELCOME TO IMJAI</p><h2>{mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครสมาชิก' : 'ลืมรหัสผ่าน'}</h2><p>{mode === 'login' ? 'กลับมาสั่งเมนูโปรดกันค่ะ' : mode === 'register' ? 'สมัครฟรี ใช้เวลาไม่ถึงหนึ่งนาที' : 'เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้'}</p><div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>เข้าสู่ระบบ</button><button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>สมัครสมาชิก</button></div><form onSubmit={handleSubmit(submit)}>{mode === 'register' && <label>ชื่อที่ใช้เรียก<input {...register('name')} autoComplete="name" placeholder="ชื่อของคุณ" /></label>}<label>อีเมล<input {...register('email')} type="email" autoComplete="email" placeholder="you@example.com" />{errors.email && <small>{errors.email.message}</small>}</label>{mode !== 'forgot' && <label>รหัสผ่าน<div className="password-field"><input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="อย่างน้อย 8 ตัวอักษร" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>{errors.password && <small>{errors.password.message}</small>}</label>}{mode === 'login' && <button className="forgot-link" type="button" onClick={() => setMode('forgot')}>ลืมรหัสผ่าน?</button>}<button className="auth-submit" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สร้างบัญชี' : 'ส่งลิงก์รีเซ็ต'}</button><AnimatePresence>{message && <motion.p className="form-message" role="status" key={message} {...rise}>{message}</motion.p>}</AnimatePresence></form><div className="auth-security"><ShieldCheck /> ข้อมูลสมาชิกถูกป้องกันด้วย Supabase Auth และ Row Level Security</div></section></motion.main>
  )}</AnimatePresence>;
}

function MemberDashboard({ user, orders, logout }: { user: SessionUser; orders: StoredOrder[]; logout: () => void }) {
  return <motion.main className="member-page" key="member" {...settle} exit={{ opacity: 0, y: 12, scale: 0.99, transition: { duration: 0.18 } }}><section className="member-head"><div className="member-avatar"><UserRound /></div><div><p>สวัสดีค่ะ</p><h1>{user.name || user.email}</h1><span>{user.verified ? 'สมาชิกอิ่มใจ' : 'สมาชิกอิ่มใจ · โหมดพรีวิว'}</span></div><button onClick={logout}><LogOut /> ออกจากระบบ</button></section><section className="member-grid"><article><h2>ข้อมูลส่วนตัว</h2><label>ชื่อ<input defaultValue={user.name} /></label><label>เบอร์โทร<input defaultValue="" /></label><button className="secondary-button">บันทึกข้อมูล</button></article><article><h2>ที่อยู่จัดส่ง</h2><div className="saved-address"><MapPin /><div><b>ยังไม่มีที่อยู่</b><span>เพิ่มที่อยู่เพื่อชำระเงินได้เร็วขึ้น</span></div></div><button className="secondary-button">+ เพิ่มที่อยู่</button></article><LineAccountCard user={user} /><article className="member-orders"><h2>ออเดอร์ล่าสุด</h2>{orders.length ? <div>{orders.map((order) => <Link key={order.orderNumber} href={`/track?order=${encodeURIComponent(order.orderNumber)}`}><b>{order.orderNumber}</b><span>{order.status} · ฿{order.totals.total}</span></Link>)}</div> : <div className="empty-member-data"><Package /><span>ยังไม่มีประวัติออเดอร์</span></div>}</article></section></motion.main>;
}

function LineAccountCard({ user }: { user: SessionUser }) {
  const [state, setState] = useState<LineAccountState | null>(
    () => user.verified ? null : { linked: false, linkedAt: null },
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user.verified) return;
    void getLineAccountState()
      .then(setState)
      .catch(() => setMessage('ตรวจสถานะ LINE ไม่สำเร็จ'));
  }, [user.verified]);

  const unlink = async () => {
    if (!window.confirm('ยกเลิกการเชื่อม LINE กับสมาชิกเว็บนี้ใช่ไหม?')) return;
    setBusy(true);
    setMessage('');
    try {
      await unlinkLineAccount();
      setState({ linked: false, linkedAt: null });
      setMessage('ยกเลิกการเชื่อม LINE แล้ว');
    } catch {
      setMessage('ยกเลิกการเชื่อมไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  return <article className="line-account-card">
    <div className="line-account-title"><Link2 /><div><h2>LINE OA</h2><span>{state?.linked ? 'เชื่อมกับสมาชิกเว็บแล้ว' : state ? 'ยังไม่ได้เชื่อม' : 'กำลังตรวจสอบ…'}</span></div></div>
    {state?.linked ? <>
      <p>ถามใน LINE ว่า “ออเดอร์ถึงไหนแล้ว” ได้เลย และเมื่อร้านเปลี่ยนสถานะออเดอร์ ระบบจะแจ้ง LINE นี้อัตโนมัติค่ะ</p>
      <button className="secondary-button" type="button" onClick={unlink} disabled={busy}><Unlink /> {busy ? 'กำลังยกเลิก…' : 'ยกเลิกการเชื่อม'}</button>
    </> : <>
      <p>เปิดแชทร้านแล้วพิมพ์ <b>เชื่อมบัญชี</b> จากนั้นกดลิงก์ที่น้องอิ่มใจส่งให้ค่ะ</p>
      <LineButton context={{ kind: 'general' }} />
    </>}
    {message && <small role="status">{message}</small>}
  </article>;
}
