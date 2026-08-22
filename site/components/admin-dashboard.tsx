'use client';

import {
  BarChart3,
  Ban,
  Check,
  ChefHat,
  ClipboardList,
  LockKeyhole,
  Package,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CATEGORIES } from '../lib/catalog';
import { isEdited, readOverrides, resetMenuItem, updateMenuItem, useMenu } from '../lib/menu-admin';
import { rise } from '../lib/motion';
import {
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  cancelOrder,
  setOrderStatus,
  setPaymentStatus,
  summarise,
  useOrders,
  type OrderStatus,
  type StoredOrder,
} from '../lib/orders';
import { useSession } from '../lib/session';
import { isSupabaseConfigured } from '../lib/supabase';
import { STORE_PROFILE, pendingRealData } from '../lib/store-profile';
import { ImJaiMark } from './brand-logo';

/**
 * The back of house.
 *
 * Everything on this screen writes to the same stores the customer-facing
 * pages read, so an action here is visible out front immediately: moving an
 * order to "กำลังปรุง" changes the customer's tracking timeline, and marking a
 * dish sold out removes it from the menu, the home page and the assistant's
 * suggestions at once.
 *
 * Two limits are stated on screen rather than hidden. Until Supabase is
 * connected the data lives in this browser, so this is one till rather than
 * every device; and the role check here is presentation — the check that
 * actually protects anything is row-level security on the server.
 */

type Tab = 'overview' | 'orders' | 'menu' | 'customers' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
  { id: 'orders', label: 'ออเดอร์', icon: ClipboardList },
  { id: 'menu', label: 'เมนูและสต็อก', icon: ChefHat },
  { id: 'customers', label: 'ลูกค้า', icon: Users },
  { id: 'settings', label: 'ตั้งค่าร้าน', icon: Settings },
];

const baht = (value: number) => `฿${Math.round(value).toLocaleString('th-TH')}`;
const shortTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * A number the shop edits by hand.
 *
 * It commits on blur rather than on every keystroke: typing "1" on the way to
 * "12" must not briefly publish a ฿1 dish to the live menu. Enter blurs, so
 * the keyboard path commits too.
 */
function NumberField({
  label,
  value,
  onCommit,
  suffix,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
  suffix?: string;
}) {
  return (
    <label className="admin-number">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        // Keyed on the value so an edit made elsewhere (or a reset) refreshes
        // the box, while typing inside it is left alone.
        key={value}
        defaultValue={value}
        inputMode="numeric"
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onBlur={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next) || next < 0) {
            event.target.value = String(value);
            return;
          }
          onCommit(Math.round(next));
        }}
      />
      {suffix && <small>{suffix}</small>}
    </label>
  );
}

function Overview({ orders }: { orders: StoredOrder[] }) {
  const stats = summarise(orders);
  const menu = useMenu();
  const low = menu.filter((item) => item.stock <= 10).sort((a, b) => a.stock - b.stock);
  const recent = orders.slice(0, 6);

  return (
    <>
      <div className="metric-grid">
        <article>
          <span><TrendingUp /></span>
          <div>
            <small>รายได้วันนี้</small>
            <h2>{baht(stats.revenue)}</h2>
            <p>
              {stats.changeVsYesterday === null
                ? 'ยังไม่มีข้อมูลเมื่อวานให้เทียบ'
                : `${stats.changeVsYesterday >= 0 ? '↑' : '↓'} ${Math.abs(stats.changeVsYesterday)}% จากเมื่อวาน`}
            </p>
          </div>
        </article>
        <article>
          <span><ClipboardList /></span>
          <div>
            <small>ออเดอร์วันนี้</small>
            <h2>{stats.orderCount}</h2>
            <p>{stats.newOrders} ออเดอร์ใหม่ที่ยังไม่ยืนยัน</p>
          </div>
        </article>
        <article>
          <span><ChefHat /></span>
          <div>
            <small>กำลังเตรียม</small>
            <h2>{stats.preparing}</h2>
            <p>เฉลี่ยต่อบิล {baht(stats.averageBasket)}</p>
          </div>
        </article>
        <article>
          <span><Wallet /></span>
          <div>
            <small>รอตรวจสลิป</small>
            <h2>{stats.awaitingPayment}</h2>
            <p>{stats.awaitingPayment ? 'ตรวจที่แท็บออเดอร์' : 'ไม่มีรายการค้าง'}</p>
          </div>
        </article>
      </div>

      <div className="admin-panels">
        <article className="orders-panel">
          <div className="panel-title">
            <div><h2>ออเดอร์ล่าสุด</h2><p>อัปเดตสถานะได้จากแท็บออเดอร์</p></div>
          </div>
          {recent.length ? (
            <div className="admin-table">
              <div className="table-head">
                <span>ออเดอร์</span><span>ลูกค้า</span><span>ยอดรวม</span><span>สถานะ</span>
              </div>
              {recent.map((order) => (
                <div className="table-row" key={order.orderNumber}>
                  <span>{order.orderNumber}</span>
                  <span>{order.name}</span>
                  <span>{baht(order.totals.total)}</span>
                  <span className={`status-pill s-${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-empty">ยังไม่มีออเดอร์เข้ามาในเครื่องนี้</p>
          )}
        </article>

        <article className="stock-panel">
          <div className="panel-title"><div><h2>สต็อกใกล้หมด</h2><p>เหลือ 10 ที่หรือน้อยกว่า</p></div></div>
          {low.length ? low.slice(0, 6).map((item) => (
            <div className="stock-row" key={item.sku}>
              <span>{item.emoji}</span>
              <div><b>{item.name}</b><small>{item.sku}</small></div>
              <em className={!item.stock ? 'empty' : ''}>{item.stock ? `เหลือ ${item.stock}` : 'หมด'}</em>
            </div>
          )) : <p className="admin-empty">สต็อกทุกเมนูยังเพียงพอ</p>}
        </article>
      </div>
    </>
  );
}

function Orders({ orders }: { orders: StoredOrder[] }) {
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th');
    return orders.filter((order) => {
      if (filter !== 'all' && order.status !== filter) return false;
      if (!needle) return true;
      return `${order.orderNumber} ${order.name} ${order.phone}`.toLocaleLowerCase('th').includes(needle);
    });
  }, [orders, filter, query]);

  return (
    <>
      <div className="admin-filters">
        <div className="admin-search">
          <Search size={16} />
          <label className="sr-only" htmlFor="order-search">ค้นหาออเดอร์</label>
          <input
            id="order-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาเลขออเดอร์ ชื่อ หรือเบอร์โทร"
          />
        </div>
        <div className="admin-chips">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            ทั้งหมด ({orders.length})
          </button>
          {ORDER_FLOW.map((status) => {
            const count = orders.filter((order) => order.status === status).length;
            return (
              <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>
                {ORDER_STATUS_LABEL[status]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {visible.length ? (
        <div className="order-cards">
          {visible.map((order) => (
            <article className="order-card" key={order.orderNumber}>
              <header>
                <div>
                  <b>{order.orderNumber}</b>
                  <small>{shortTime(order.createdAt)} · {order.fulfilment === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'}</small>
                </div>
                <strong>{baht(order.totals.total)}</strong>
              </header>

              <div className="order-card-customer">
                <span>{order.name}</span>
                <a href={`tel:${order.phone}`}>{order.phone}</a>
                {order.address && <small>{order.address}</small>}
                {order.note && <em>หมายเหตุ: {order.note}</em>}
              </div>

              <ul className="order-card-lines">
                {order.lines.map((line, index) => (
                  <li key={`${line.id}-${index}`}>
                    <span>{line.quantity} ×</span>
                    <div>
                      <b>{line.name}</b>
                      {(line.options?.length || line.addOns?.length || line.note) && (
                        <small>
                          {[...(line.options ?? []), ...(line.addOns ?? []).map((addOn) => `+${addOn.name}`), line.note]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <div className={`order-card-payment pay-${order.paymentStatus}`}>
                <div>
                  <b>{order.payment === 'promptpay' ? 'พร้อมเพย์' : 'เงินสด'} · {PAYMENT_STATUS_LABEL[order.paymentStatus]}</b>
                  <small>
                    ยอดที่ต้องได้รับ {order.payableAmount.toFixed(2)}
                    {order.slipReference ? ` · อ้างอิงสลิป ${order.slipReference.slice(0, 18)}` : ''}
                  </small>
                </div>
                {order.paymentStatus === 'pending_verification' && (
                  <div className="order-card-verify">
                    <button
                      type="button"
                      className="ok"
                      onClick={() => setPaymentStatus(order.orderNumber, 'paid', 'พนักงานตรวจสลิปด้วยตนเองแล้ว')}
                    >
                      <Check size={14} /> ยืนยันยอด
                    </button>
                    <button
                      type="button"
                      className="stop"
                      onClick={() =>
                        setPaymentStatus(order.orderNumber, 'rejected', 'ยอดในสลิปไม่ตรงกับออเดอร์ กรุณาติดต่อร้าน')
                      }
                    >
                      <X size={14} /> ยอดไม่ตรง
                    </button>
                  </div>
                )}
              </div>

              <div className="order-card-actions">
                <label>
                  <span className="sr-only">สถานะออเดอร์ {order.orderNumber}</span>
                  <select
                    value={order.status}
                    onChange={(event) => setOrderStatus(order.orderNumber, event.target.value as OrderStatus)}
                    disabled={order.status === 'cancelled'}
                  >
                    {ORDER_FLOW.map((status) => (
                      <option value={status} key={status}>{ORDER_STATUS_LABEL[status]}</option>
                    ))}
                  </select>
                </label>
                {order.status !== 'cancelled' && (
                  <button type="button" className="ghost" onClick={() => cancelOrder(order.orderNumber)}>
                    <Ban size={14} /> ยกเลิก
                  </button>
                )}
                <Link prefetch={false} className="ghost" href={`/track?order=${encodeURIComponent(order.orderNumber)}`}>
                  ดูแบบลูกค้าเห็น
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty">
          {orders.length ? 'ไม่มีออเดอร์ที่ตรงกับตัวกรองนี้' : 'ยังไม่มีออเดอร์เข้ามาในเครื่องนี้ ลองสั่งทดสอบจากหน้าเมนูดูได้'}
        </p>
      )}
    </>
  );
}

function MenuManager() {
  const menu = useMenu();
  const overrides = readOverrides();
  const [category, setCategory] = useState<string>('all');
  const items = menu.filter((item) => category === 'all' || item.category === category);

  return (
    <>
      <div className="admin-filters">
        <div className="admin-chips">
          {CATEGORIES.map((entry) => (
            <button type="button" key={entry.id} className={category === entry.id ? 'active' : ''} onClick={() => setCategory(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
        <p className="admin-hint">แก้ราคาแล้วกด Enter หรือคลิกนอกช่องเพื่อบันทึก · ตั้งสต็อกเป็น 0 เมนูจะขึ้นว่าหมดทันที</p>
      </div>

      <div className="menu-manager">
        {items.map((item) => (
          <article className={`menu-editor ${item.available ? '' : 'is-off'}`} key={item.sku}>
            <span className={`menu-editor-art ${item.tone}`}>{item.emoji}</span>
            <div className="menu-editor-title">
              <b>{item.name}</b>
              <small>{item.sku} · {CATEGORIES.find((entry) => entry.id === item.category)?.label}</small>
              {isEdited(item.sku, overrides) && <em>แก้ไขจากเมนูตั้งต้น</em>}
            </div>

            <NumberField label="ราคา" value={item.price} suffix="บาท" onCommit={(price) => updateMenuItem(item.sku, { price })} />
            <NumberField label="สต็อก" value={item.stock} suffix="ที่" onCommit={(stock) => updateMenuItem(item.sku, { stock })} />

            <div className="menu-editor-actions">
              <button
                type="button"
                className={item.available ? 'on' : 'off'}
                onClick={() => updateMenuItem(item.sku, { available: !item.available, stock: item.available ? item.stock : Math.max(item.stock, 1) })}
              >
                {item.available ? 'เปิดขาย' : 'ปิดขาย'}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!isEdited(item.sku, overrides)}
                onClick={() => resetMenuItem(item.sku)}
                aria-label={`คืนค่า ${item.name}`}
              >
                <RotateCcw size={14} /> คืนค่า
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Customers({ orders }: { orders: StoredOrder[] }) {
  // Grouped by phone: the same person ordering twice under "มิน" and "คุณมิน"
  // is still one customer, and the phone is what the shop calls back on.
  const people = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; orders: number; spend: number; last: string }>();
    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      const key = order.phone.replace(/\D/g, '') || order.name;
      const entry = map.get(key);
      if (entry) {
        entry.orders += 1;
        entry.spend += order.totals.total;
        if (order.createdAt > entry.last) {
          entry.last = order.createdAt;
          entry.name = order.name;
        }
      } else {
        map.set(key, { name: order.name, phone: order.phone, orders: 1, spend: order.totals.total, last: order.createdAt });
      }
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend);
  }, [orders]);

  if (!people.length) return <p className="admin-empty">ยังไม่มีข้อมูลลูกค้า ข้อมูลจะสร้างขึ้นเองเมื่อมีออเดอร์เข้ามา</p>;

  return (
    <div className="admin-table wide">
      <div className="table-head">
        <span>ลูกค้า</span><span>เบอร์โทร</span><span>จำนวนออเดอร์</span><span>ยอดสะสม</span><span>สั่งล่าสุด</span>
      </div>
      {people.map((person) => (
        <div className="table-row" key={person.phone || person.name}>
          <span>{person.name}</span>
          <span>{person.phone || '—'}</span>
          <span>{person.orders}</span>
          <span>{baht(person.spend)}</span>
          <span>{shortTime(person.last)}</span>
        </div>
      ))}
    </div>
  );
}

function StoreSettings() {
  return (
    <div className="admin-settings">
      <article>
        <h2>ข้อมูลร้าน</h2>
        <dl>
          <div><dt>ชื่อร้าน</dt><dd>{STORE_PROFILE.nameTh} ({STORE_PROFILE.name})</dd></div>
          <div><dt>เจ้าของ</dt><dd>{STORE_PROFILE.owner.name}</dd></div>
          <div><dt>ที่อยู่</dt><dd>{STORE_PROFILE.location.address}</dd></div>
          <div><dt>เวลาเปิด</dt><dd>{STORE_PROFILE.hours.everyday} · ครัวปิดรับ {STORE_PROFILE.hours.kitchenLastOrder}</dd></div>
          <div><dt>ยอดขั้นต่ำ</dt><dd>{baht(STORE_PROFILE.service.minimumOrder)}</dd></div>
          <div><dt>ค่าส่ง</dt><dd>{baht(STORE_PROFILE.service.deliveryFee)} · ส่งฟรีเมื่อถึง {baht(STORE_PROFILE.service.freeDeliveryAt)}</dd></div>
        </dl>
        <p className="admin-hint">ค่าเหล่านี้อยู่ในไฟล์ lib/store-profile.ts แก้แล้วจะเปลี่ยนทุกหน้าพร้อมกัน</p>
      </article>

      <article className="admin-todo">
        <h2>ข้อมูลที่ยังต้องใช้ของจริง</h2>
        <ul>{pendingRealData.map((entry) => <li key={entry}><ShieldAlert size={14} /> {entry}</li>)}</ul>
        <p className="admin-hint">ตอนนี้ยังเป็นข้อมูลตัวอย่างที่ตั้งไว้ให้ระบบทำงานได้ ส่งข้อมูลจริงมาแล้วเปลี่ยนได้ทันที</p>
      </article>

      <article className={isSupabaseConfigured ? 'admin-status ok' : 'admin-status wait'}>
        <h2>สถานะการเชื่อมต่อ</h2>
        <p>
          {isSupabaseConfigured
            ? 'เชื่อมต่อ Supabase แล้ว ออเดอร์และบัญชีผู้ใช้ทำงานกับฐานข้อมูลจริง'
            : 'ยังไม่ได้เชื่อม Supabase — ออเดอร์ บัญชี และการแก้เมนูจะถูกเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ใส่ค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY แล้วระบบจะสลับไปใช้ฐานข้อมูลจริงเอง'}
        </p>
      </article>
    </div>
  );
}

export function AdminDashboard() {
  // The same session the header reads, so the link and the page can never
  // disagree about who is staff. Hiding the link is presentation; this is the
  // check that matters — and once Supabase is connected, row-level security
  // is the one that actually protects the data.
  const session = useSession();
  const orders = useOrders();
  const [tab, setTab] = useState<Tab>('overview');
  const { status, role } = session;

  if (status === 'loading') {
    return <main className="admin-lock"><span className="loading-ring" /><p>กำลังตรวจสอบสิทธิ์…</p></main>;
  }

  if (role !== 'admin') {
    return (
      <main className="admin-lock">
        <span><LockKeyhole /></span>
        <h1>สำหรับทีมงานอิ่มใจ</h1>
        <p>หน้านี้อนุญาตเฉพาะบัญชี staff และ admin เท่านั้น สิทธิ์ถูกตรวจจากระบบหลังบ้าน ไม่สามารถเปลี่ยนจากหน้าเว็บได้</p>
        <Link prefetch={false} className="primary-button" href="/account">เข้าสู่ระบบพนักงาน</Link>
        <small><ShieldAlert /> หากคิดว่าควรเข้าถึงได้ กรุณาติดต่อผู้ดูแลระบบ</small>
      </main>
    );
  }

  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0];

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link className="brand" href="/">
          <ImJaiMark size={34} title={null} />
          <span><b>IMJAI</b><small>STORE ADMIN</small></span>
        </Link>
        <nav>
          {TABS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button type="button" key={entry.id} className={tab === entry.id ? 'active' : ''} onClick={() => setTab(entry.id)}>
                <Icon /> {entry.label}
              </button>
            );
          })}
        </nav>
        <div className="admin-user">
          <span>{(session.user?.name ?? 'A').slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{session.user?.email ?? 'ยังไม่ได้เข้าสู่ระบบ'}</b>
            <small>{session.user?.verified ? 'แอดมิน' : 'แอดมิน · โหมดพรีวิว'}</small>
          </div>
        </div>
      </aside>

      <section className="admin-content">
        <header>
          <div>
            <p className="eyebrow">STORE OPERATIONS</p>
            <h1>{active.label}</h1>
          </div>
          <span className="admin-count">{orders.length} ออเดอร์ในระบบ</span>
        </header>

        {!isSupabaseConfigured && (
          <p className="admin-banner">
            <Package size={15} /> โหมดพรีวิว — ออเดอร์และการแก้เมนูถูกเก็บในเบราว์เซอร์เครื่องนี้ ยังไม่ได้ซิงก์ข้ามอุปกรณ์
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={tab} {...rise}>
            {tab === 'overview' && <Overview orders={orders} />}
            {tab === 'orders' && <Orders orders={orders} />}
            {tab === 'menu' && <MenuManager />}
            {tab === 'customers' && <Customers orders={orders} />}
            {tab === 'settings' && <StoreSettings />}
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}
