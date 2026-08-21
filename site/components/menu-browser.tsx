'use client';

import { motion } from 'motion/react';
import { Check, ChevronDown, Minus, Plus, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CATEGORIES, MENU_ITEMS, type MenuCategory, type MenuItem } from '../lib/catalog';
import { useCartStore } from '../stores/cart-store';

type SortValue = 'recommended' | 'price-low' | 'price-high' | 'popular';

export function MenuBrowser() {
  const params = useSearchParams();
  const initialCategory = (params.get('category') as MenuCategory | null) ?? 'all';
  const [category, setCategory] = useState<'all' | MenuCategory>(CATEGORIES.some((item) => item.id === initialCategory) ? initialCategory : 'all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('recommended');
  const [selected, setSelected] = useState<MenuItem | null>(() => {
    const sku = params.get('item');
    return sku ? MENU_ITEMS.find((item) => item.sku === sku) ?? null : null;
  });

  const items = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th');
    const result = MENU_ITEMS.filter((item) => (category === 'all' || item.category === category) && (!normalized || `${item.name} ${item.description} ${item.ingredients}`.toLocaleLowerCase('th').includes(normalized)));
    if (sort === 'price-low') return result.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') return result.sort((a, b) => b.price - a.price);
    if (sort === 'popular') return result.sort((a, b) => Number(b.featured) - Number(a.featured));
    return result.sort((a, b) => Number(b.chefChoice) - Number(a.chefChoice));
  }, [category, query, sort]);

  return (
    <main className="menu-page">
      <section className="page-hero compact"><p className="eyebrow">OUR MENU</p><h1>เลือกความอร่อย<br />ในแบบของคุณ</h1><p>ทุกเมนูปรุงสด เลือกตัวเลือกและหมายเหตุได้ก่อนใส่ตะกร้า</p></section>
      <section className="menu-toolbar" aria-label="ค้นหาและกรองเมนู">
        <div className="search-box"><Search size={18} /><label className="sr-only" htmlFor="menu-search">ค้นหาเมนู</label><input id="menu-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อเมนูหรือส่วนประกอบ" /></div>
        <div className="sort-box"><SlidersHorizontal size={17} /><label className="sr-only" htmlFor="menu-sort">เรียงเมนู</label><select id="menu-sort" value={sort} onChange={(event) => setSort(event.target.value as SortValue)}><option value="recommended">เมนูแนะนำ</option><option value="popular">ความนิยม</option><option value="price-low">ราคาน้อย–มาก</option><option value="price-high">ราคามาก–น้อย</option></select><ChevronDown size={16} /></div>
      </section>
      <div className="category-tabs" role="tablist" aria-label="หมวดหมู่เมนู">{CATEGORIES.map((item) => <button role="tab" aria-selected={category === item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)} key={item.id}>{item.label}</button>)}</div>
      <section className="catalog-section">
        <div className="catalog-heading"><p>พบ <b>{items.length}</b> เมนู</p><span>ข้อมูลสินค้าและสต็อกล่าสุด</span></div>
        {items.length ? <div className="catalog-grid">{items.map((item, index) => <motion.article className={`catalog-card ${!item.available ? 'sold-out' : ''}`} key={item.sku} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * .035 }}>
          <button className={`catalog-art ${item.tone}`} onClick={() => setSelected(item)} disabled={!item.available} aria-label={`ดูรายละเอียด ${item.name}`}><span>{item.emoji}</span>{item.chefChoice && <em><Star size={12} fill="currentColor" /> Chef&apos;s Choice</em>}{!item.available && <b>หมดวันนี้</b>}<small>เหลือ {item.stock}</small></button>
          <div className="catalog-copy"><p>{CATEGORIES.find((categoryItem) => categoryItem.id === item.category)?.label}</p><div className="catalog-title"><h2>{item.name}</h2><b>฿{item.price}</b></div><span>{item.description}</span>{item.allergens.length > 0 && <small>สารก่อภูมิแพ้: {item.allergens.join(', ')}</small>}<button disabled={!item.available} onClick={() => setSelected(item)}>{item.available ? 'เลือกตัวเลือก' : 'สินค้าหมด'} <Plus size={16} /></button></div>
        </motion.article>)}</div> : <div className="no-results"><span>🔎</span><h2>ยังไม่พบเมนูที่ค้นหา</h2><p>ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่นนะคะ</p></div>}
      </section>
      <ProductModal key={selected?.sku ?? 'none'} item={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function ProductModal({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const add = useCartStore((state) => state.add);
  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState<Record<string, string>>(() => Object.fromEntries((item?.options ?? []).map((group) => [group.label, group.values[0]])));
  const [addOns, setAddOns] = useState<string[]>([]);
  const [note, setNote] = useState('');

  if (!item) return null;
  const selectedAddOns = (item.addOns ?? []).filter((addOn) => addOns.includes(addOn.name));
  const eachPrice = item.price + selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const submit = () => { add({ sku: item.sku, name: item.name, unitPrice: item.price, quantity, options: Object.values(options), addOns: selectedAddOns, note: note.trim().slice(0, 160), emoji: item.emoji }); onClose(); };

  return <><motion.button className="modal-backdrop" aria-label="ปิดรายละเอียดเมนู" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} /><motion.section className="product-modal" role="dialog" aria-modal="true" aria-label={`รายละเอียด ${item.name}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <button className="modal-close" onClick={onClose} aria-label="ปิด"><X /></button>
    <div className={`product-modal-art ${item.tone}`}><span>{item.emoji}</span>{item.chefChoice && <em><Star size={13} fill="currentColor" /> Chef&apos;s Choice</em>}</div>
    <div className="product-modal-copy"><p className="eyebrow">{item.sku}</p><div className="modal-title"><h2>{item.name}</h2><b>฿{item.price}</b></div><p>{item.description}</p><details><summary>ส่วนประกอบและสารก่อภูมิแพ้</summary><p>{item.ingredients}</p><small>{item.allergens.length ? `มี: ${item.allergens.join(', ')}` : 'ไม่ระบุสารก่อภูมิแพ้หลัก'}</small></details>
      {(item.options ?? []).map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div className="option-chips">{group.values.map((value) => <button type="button" className={options[group.label] === value ? 'active' : ''} onClick={() => setOptions((current) => ({ ...current, [group.label]: value }))} key={value}>{options[group.label] === value && <Check size={14} />}{value}</button>)}</div></fieldset>)}
      {!!item.addOns?.length && <fieldset><legend>เพิ่มความอร่อย</legend><div className="addon-list">{item.addOns.map((addOn) => <label key={addOn.name}><input type="checkbox" checked={addOns.includes(addOn.name)} onChange={() => setAddOns((current) => current.includes(addOn.name) ? current.filter((name) => name !== addOn.name) : [...current, addOn.name])} /><span>{addOn.name}</span><b>+฿{addOn.price}</b></label>)}</div></fieldset>}
      <label className="note-field">หมายเหตุถึงครัว<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={160} placeholder="เช่น ไม่ใส่ผงชูรส แยกน้ำแข็ง" /></label>
      <div className="modal-order-bar"><div className="quantity-stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="ลดจำนวน"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="เพิ่มจำนวน"><Plus /></button></div><button className="add-cart-button" onClick={submit}>เพิ่มลงตะกร้า <b>฿{eachPrice * quantity}</b></button></div>
    </div>
  </motion.section></>;
}
