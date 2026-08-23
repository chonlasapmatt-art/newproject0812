'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowDownRight, ArrowRight, Clock3, Heart, MapPin, PackageCheck, Quote, ShieldCheck, Sparkles, Star, UtensilsCrossed } from 'lucide-react';
import { STORE } from '../lib/catalog';
import { DEMO_REVIEWS } from '../lib/store-profile';
import { useMenu } from '../lib/menu-admin';
import { Divider, RevealLines } from './reveal-text';
import { StoreMap } from './store-map';
import { Magnetic } from './magnetic';
import { FactsMarquee } from './marquee';
import { useMotionOK } from '../lib/motion';
import { Tilt } from './tilt';
import { useAddToCart } from '../lib/add-to-cart';

const categories = [
  { name: 'กาแฟ', href: '/menu?category=coffee', icon: '☕', note: 'เมล็ดอาราบิก้าคั่วกลาง' },
  { name: 'อาหาร', href: '/menu?category=food', icon: '🍳', note: 'ทำสดใหม่ทุกจาน' },
  { name: 'เครื่องดื่ม', href: '/menu?category=non-coffee', icon: '🍵', note: 'สดชื่นทุกช่วงเวลา' },
  { name: 'เบเกอรี่', href: '/menu?category=dessert', icon: '🥐', note: 'อบหอมทุกเช้า' },
];

export function HomePage() {
  const addToCart = useAddToCart();
  // Sold out at the till should read as sold out on the front page.
  const favourites = useMenu().filter((item) => item.featured).slice(0, 4);

  /**
   * The hero drifts apart as the page moves.
   *
   * Three layers at three speeds: the sun furthest back and slowest, the
   * plates in front of it, the leaves nearest and travelling with the scroll
   * rather than against it. Depth here comes from the difference between the
   * speeds, so the amounts stay small — enough to separate the planes, not
   * enough to pull the composition apart before it leaves the screen.
   */
  const motionOK = useMotionOK();
  const { scrollY } = useScroll();
  const still: [number, number] = [0, 0];
  const sunY = useTransform(scrollY, [0, 800], motionOK ? [0, -96] : still);
  const plateY = useTransform(scrollY, [0, 800], motionOK ? [0, -46] : still);
  const leafY = useTransform(scrollY, [0, 800], motionOK ? [0, 54] : still);

  return (
    <main>
      <section className="hero home-hero" id="top">
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
          <p className="eyebrow">EVERYDAY COMFORT, MADE WITH HEART</p>
          <RevealLines
            as="h1"
            delay={0.05}
            lines={['มื้อธรรมดา', <>ที่ทำให้ใจ<em>อิ่ม</em></>]}
          />
          <p className="hero-lede">อาหารจานโปรด กาแฟหอม และขนมอบสดใหม่<br className="desktop-break" /> พร้อมส่งต่อความอบอุ่นจากครัวของเรา</p>
          <div className="hero-actions">
            <Magnetic><Link prefetch={false} className="primary-button" href="/menu">ดูเมนูวันนี้ <ArrowRight size={17} /></Link></Magnetic>
            <a className="text-link" href="#location">แวะมาหาเรา <ArrowDownRight size={16} /></a>
          </div>
          <div className="service-note"><span className="status-dot" /> เปิดทุกวัน 07:00–20:00 น.<span className="divider" /> รับที่ร้านและจัดส่ง</div>
        </motion.div>
        <div className="hero-visual" aria-label="ภาพประกอบเมนูกะเพราหมูสับ ลาเต้ และครัวซองต์">
          <motion.div className="parallax-plane" style={{ y: sunY }}><div className="sun" /></motion.div>
          <motion.div className="parallax-plane" style={{ y: plateY }}>
            <div className="plate plate-main"><span role="img" aria-label="ข้าวกะเพราไข่ดาว">🍳</span><i>กะเพราหมูสับ</i></div>
            <div className="plate plate-side"><span role="img" aria-label="ลาเต้">☕</span></div>
          </motion.div>
          <motion.div className="parallax-plane" style={{ y: leafY }}>
            <div className="leaf leaf-one">❧</div><div className="leaf leaf-two">❧</div>
          </motion.div>
          <div className="handwritten">made with<br /><b>ใจ</b></div>
        </div>
      </section>

      <section className="trust-bar" aria-label="จุดเด่นของร้าน">
        <span><UtensilsCrossed /> ปรุงสดทุกออเดอร์</span><span><Sparkles /> วัตถุดิบคัดสรร</span><span><PackageCheck /> รับที่ร้านหรือจัดส่ง</span><span><ShieldCheck /> ชำระเงินปลอดภัย</span>
      </section>

      <FactsMarquee />

      <section className="menu-preview page-section">
        <div className="section-heading"><div><p className="eyebrow">IMJAI FAVOURITES</p><RevealLines as="h2" lines={['เมนูที่ใครมาก็คิดถึง']} /></div><div><p>คัดวัตถุดิบดี ปรุงสดใหม่<br />ในแบบที่อยากทำให้คนที่เรารักทาน</p><Link prefetch={false} className="section-link" href="/menu">ดูเมนูทั้งหมด <ArrowRight size={15} /></Link></div></div>
        <div className="menu-grid featured-grid">
          {favourites.map((item, index) => (
            <Tilt key={item.sku} strength={7} lift={12}><motion.article data-reveal className="menu-card" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }}>
              <Link prefetch={false} href={`/menu?item=${item.sku}`} className={`dish-illustration ${item.tone}`}>
                {item.category === 'coffee' && <><span className="steam steam-one" /><span className="steam steam-two" /></>}
                <span role="img" aria-label={item.name}>{item.emoji}</span><small>{String(index + 1).padStart(2, '0')}</small>
                {item.chefChoice && <em><Star size={12} fill="currentColor" /> Chef&apos;s Choice</em>}
              </Link>
              <div className="menu-card-copy"><div><h3>{item.name}</h3><p>{item.description}</p></div><b>฿{item.price}</b></div>
              <button className="quick-add" onClick={() => addToCart({ sku: item.sku, name: item.name, unitPrice: item.price, quantity: 1, emoji: item.emoji })}>+ เพิ่มลงตะกร้า</button>
            </motion.article></Tilt>
          ))}
        </div>
      </section>

      <Divider />

      <section className="category-section page-section">
        <p className="eyebrow">CHOOSE YOUR MOOD</p><RevealLines as="h2" lines={['วันนี้อยากทานอะไรดี']} />
        <div className="category-grid">{categories.map((category) => <Link prefetch={false} href={category.href} key={category.name}><span>{category.icon}</span><div><b>{category.name}</b><small>{category.note}</small></div><ArrowRight /></Link>)}</div>
      </section>

      <section className="promotion-band">
        <div className="promotion-art"><span>☕</span><b>+</b><span>🥐</span></div>
        <div><p className="eyebrow">A LITTLE HAPPINESS</p><h2>กาแฟหรือชา + เบเกอรี่<br /><em>ลดทันที 15 บาท</em></h2><p>เพียงใส่เมนูที่ร่วมรายการลงตะกร้า วันนี้–31 ส.ค. 2569</p><Magnetic><Link prefetch={false} className="primary-button" href="/menu">เลือกคู่โปรด <ArrowRight size={17} /></Link></Magnetic></div>
      </section>

      <section className="story-section" id="story">
        <div className="story-art"><div className="story-circle">อ</div><span className="story-sprig">❧</span><small>SINCE 2026</small></div>
        <div><p className="eyebrow">OUR LITTLE STORY</p><RevealLines as="h2" lines={['ครัวเล็ก ๆ', 'ที่ตั้งใจทำให้ทุกคน', 'รู้สึกเหมือนได้กลับบ้าน']} /><p>“Home-Cooked Professionalism” คือความอบอุ่นแบบอาหารบ้าน ควบคู่กับมาตรฐานที่เราใส่ใจ ตั้งแต่วัตถุดิบจนถึงมือคุณ</p><div className="story-sign">ด้วยใจ — ทีมอิ่มใจ <Heart size={18} /></div></div>
      </section>

      <Divider />

      <section className="reviews-section page-section">
        <p className="eyebrow">WORDS FROM OUR GUESTS</p><RevealLines as="h2" lines={['ความอิ่มใจจากโต๊ะข้าง ๆ']} />
        {/* The badge is the whole point of keeping these: the section can show
            its shape without anyone reading invented praise as real. */}
        <p className="demo-badge">ตัวอย่างการแสดงผล · จะเปลี่ยนเป็นรีวิวจริงเมื่อเปิดร้าน</p>
        <div className="review-grid">
          {DEMO_REVIEWS.map((review) => (
            <article key={review.name}>
              <Quote />
              <div className="stars" aria-hidden>★★★★★</div>
              <p>{review.quote}</p>
              <b>{review.name} · {review.context}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="visit-section" id="location">
        <StoreMap className="visit-map" />
        <div className="visit-copy"><p className="eyebrow">COME SAY HELLO</p><RevealLines as="h2" lines={['แวะมาพักใจ', 'แล้วทานอะไรอร่อย ๆ']} /><dl><div><dt><MapPin /></dt><dd><b>ที่ตั้งร้าน</b><span>{STORE.address}</span></dd></div><div><dt><Clock3 /></dt><dd><b>เวลาเปิด–ปิด</b><span>{STORE.hours}</span></dd></div></dl><a className="primary-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE.address)}`} target="_blank" rel="noreferrer">เปิดแผนที่ <ArrowRight size={17} /></a></div>
      </section>
    </main>
  );
}
