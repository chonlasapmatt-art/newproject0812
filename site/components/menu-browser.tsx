'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Minus, Plus, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIES, type MenuCategory, type MenuItem } from '../lib/catalog';
import { settle, useMotionOK } from '../lib/motion';
import { useMenu, useMenuItem } from '../lib/menu-admin';
import { DishArt } from './dish-art';
import { DishEffects } from './dish-effects';
import { Tilt } from './tilt';
import { useAddToCart } from '../lib/add-to-cart';

type SortValue = 'recommended' | 'price-low' | 'price-high' | 'popular';

export function MenuBrowser() {
  const params = useSearchParams();
  const initialCategory = (params.get('category') as MenuCategory | null) ?? 'all';
  const [category, setCategory] = useState<'all' | MenuCategory>(CATEGORIES.some((item) => item.id === initialCategory) ? initialCategory : 'all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('recommended');
  // The sheet holds a SKU rather than a copy of the dish, so a price or stock
  // change the shop makes while it is open reaches the customer looking at it.
  const [selectedSku, setSelectedSku] = useState<string | null>(() => params.get('item'));
  const menu = useMenu();
  const selected = useMenuItem(selectedSku);
  const motionOK = useMotionOK();

  const items = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th');
    const result = menu.filter((item) => (category === 'all' || item.category === category) && (!normalized || `${item.name} ${item.description} ${item.ingredients}`.toLocaleLowerCase('th').includes(normalized)));
    if (sort === 'price-low') return result.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') return result.sort((a, b) => b.price - a.price);
    if (sort === 'popular') return result.sort((a, b) => Number(b.featured) - Number(a.featured));
    return result.sort((a, b) => Number(b.chefChoice) - Number(a.chefChoice));
  }, [menu, category, query, sort]);

  return (
    <main className="menu-page">
      <section className="page-hero compact"><p className="eyebrow">OUR MENU</p><h1>เลือกความอร่อย<br />ในแบบของคุณ</h1><p>ทุกเมนูปรุงสด เลือกตัวเลือกและหมายเหตุได้ก่อนใส่ตะกร้า</p></section>
      <section className="menu-toolbar" aria-label="ค้นหาและกรองเมนู">
        <div className="search-box"><Search size={18} /><label className="sr-only" htmlFor="menu-search">ค้นหาเมนู</label><input id="menu-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อเมนูหรือส่วนประกอบ" />{query && <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="ล้างคำค้นหา"><X size={15} /></button>}</div>
        <div className="sort-box"><SlidersHorizontal size={17} /><label className="sr-only" htmlFor="menu-sort">เรียงเมนู</label><select id="menu-sort" value={sort} onChange={(event) => setSort(event.target.value as SortValue)}><option value="recommended">เมนูแนะนำ</option><option value="popular">ความนิยม</option><option value="price-low">ราคาน้อย–มาก</option><option value="price-high">ราคามาก–น้อย</option></select><ChevronDown size={16} /></div>
      </section>
      <div className="category-tabs" role="tablist" aria-label="หมวดหมู่เมนู">{CATEGORIES.map((item) => { const isActive = category === item.id; return <button role="tab" aria-selected={isActive} className={isActive ? 'active' : ''} onClick={() => setCategory(item.id)} key={item.id}>{isActive && <motion.span className="category-tab-pill" layoutId="category-pill" transition={motionOK ? { type: 'spring', stiffness: 380, damping: 32 } : { duration: 0 }} />}<span className="category-tab-label">{item.label}</span></button>; })}</div>
      <section className="catalog-section">
        <div className="catalog-heading"><p>พบ <b>{items.length}</b> เมนู</p><span>ข้อมูลสินค้าและสต็อกล่าสุด</span></div>
        {items.length ? <div className="catalog-grid"><AnimatePresence mode="popLayout">{items.map((item, index) => <Tilt key={item.sku} strength={7} lift={12}><motion.article layout className={`catalog-card ${!item.available ? 'sold-out' : ''}`} key={item.sku} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }} transition={{ delay: Math.min(index, 8) * .035 }}>
          <button className={`catalog-art ${item.tone}`} onClick={() => setSelectedSku(item.sku)} disabled={!item.available} aria-label={`ดูรายละเอียด ${item.name}`}><DishEffects category={item.category} hot={item.hot} />{item.image ? <DishArt src={item.image} alt={item.name} sizes="(max-width: 900px) 50vw, 25vw" /> : <span>{item.emoji}</span>}{item.chefChoice && <em><Star size={12} fill="currentColor" /> Chef&apos;s Choice</em>}{!item.available && <b>หมดวันนี้</b>}<small>เหลือ {item.stock}</small></button>
          <div className="catalog-copy"><p>{CATEGORIES.find((categoryItem) => categoryItem.id === item.category)?.label}</p><div className="catalog-title"><h2>{item.name}</h2><b>฿{item.price}</b></div><span>{item.description}</span>{item.allergens.length > 0 && <small>สารก่อภูมิแพ้: {item.allergens.join(', ')}</small>}<button disabled={!item.available} onClick={() => setSelectedSku(item.sku)}>{item.available ? 'เลือกตัวเลือก' : 'สินค้าหมด'} <Plus size={16} /></button></div>
        </motion.article></Tilt>)}</AnimatePresence></div> : <div className="no-results"><span>🔎</span><h2>ยังไม่พบเมนูที่ค้นหา</h2><p>ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่นนะคะ</p></div>}
      </section>
      <ModalLayer>
        <AnimatePresence>{selected && <ProductModal key={selected.sku} item={selected} onClose={() => setSelectedSku(null)} />}</AnimatePresence>
      </ModalLayer>
    </main>
  );
}

/**
 * `main` is lifted above the paper grain with `position: relative; z-index: 1`,
 * and that makes it a stacking context: anything inside it is sealed under
 * z-index 1 no matter how high its own z-index is. The dish sheet asks for 70
 * and still ended up beneath the chat button at 39.
 *
 * A portal to `document.body` is the fix, and it is the right shape for a
 * modal anyway — an overlay belongs to the viewport, not to the section of
 * the page that happened to open it.
 *
 * The subscribe callback never fires because the answer never changes; this is
 * only asking React which pass we are in, so the server renders the sheet
 * inline and the client moves it to the body on hydration.
 */
const noop = () => () => {};

function ModalLayer({ children }: { children: React.ReactNode }) {
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  if (!onClient) return null;
  // The layer does the centring. Auto margins on the sheet itself left it
  // eight pixels high, because its height comes from a max-height cap rather
  // than a definite value and the margin equation has nothing to split.
  return createPortal(<div className="modal-layer">{children}</div>, document.body);
}

function ProductModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addToCart = useAddToCart();
  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState<Record<string, string>>(() => Object.fromEntries((item.options ?? []).map((group) => [group.label, group.values[0]])));
  const [addOns, setAddOns] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const selectedAddOns = (item.addOns ?? []).filter((addOn) => addOns.includes(addOn.name));
  const eachPrice = item.price + selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const submit = () => { addToCart({ sku: item.sku, name: item.name, unitPrice: item.price, quantity, options: Object.values(options), addOns: selectedAddOns, note: note.trim().slice(0, 160), emoji: item.emoji }); onClose(); };

  return <><motion.button className="modal-backdrop" aria-label="ปิดรายละเอียดเมนู" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.section className="product-modal" role="dialog" aria-modal="true" aria-label={`รายละเอียด ${item.name}`} {...settle} exit={{ opacity: 0, y: 12, scale: 0.99, transition: { duration: 0.18 } }}>
    <button className="modal-close" onClick={onClose} aria-label="ปิด"><X /></button>
    <div className={`product-modal-art ${item.tone}`}><DishEffects category={item.category} hot={item.hot} />{item.image ? <DishArt src={item.image} alt={item.name} sizes="(max-width: 820px) 100vw, 45vw" /> : <span>{item.emoji}</span>}{item.chefChoice && <em><Star size={13} fill="currentColor" /> Chef&apos;s Choice</em>}</div>
    <div className="product-modal-copy"><p className="eyebrow">{item.sku}</p><div className="modal-title"><h2>{item.name}</h2><b>฿{item.price}</b></div><p>{item.description}</p><details><summary>ส่วนประกอบและสารก่อภูมิแพ้</summary><p>{item.ingredients}</p><small>{item.allergens.length ? `มี: ${item.allergens.join(', ')}` : 'ไม่ระบุสารก่อภูมิแพ้หลัก'}</small></details>
      {(item.options ?? []).map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div className="option-chips">{group.values.map((value) => <button type="button" className={options[group.label] === value ? 'active' : ''} onClick={() => setOptions((current) => ({ ...current, [group.label]: value }))} key={value}>{options[group.label] === value && <Check size={14} />}{value}</button>)}</div></fieldset>)}
      {!!item.addOns?.length && <fieldset><legend>เพิ่มความอร่อย</legend><div className="addon-list">{item.addOns.map((addOn) => <label key={addOn.name}><input type="checkbox" checked={addOns.includes(addOn.name)} onChange={() => setAddOns((current) => current.includes(addOn.name) ? current.filter((name) => name !== addOn.name) : [...current, addOn.name])} /><span>{addOn.name}</span><b>+฿{addOn.price}</b></label>)}</div></fieldset>}
      <label className="note-field">หมายเหตุถึงครัว<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={160} placeholder="เช่น ไม่ใส่ผงชูรส แยกน้ำแข็ง" /></label>
      <div className="modal-order-bar"><div className="quantity-stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="ลดจำนวน"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="เพิ่มจำนวน"><Plus /></button></div><button className="add-cart-button" onClick={submit}>เพิ่มลงตะกร้า <b>฿{eachPrice * quantity}</b></button></div>
    </div>
  </motion.section></>;
}
