'use client';

import Link from 'next/link';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import type { PointerEvent } from 'react';
import { ArrowDownRight, ArrowRight, Clock3, Heart, MapPin, PackageCheck, Quote, ShieldCheck, Sparkles, Star, UtensilsCrossed } from 'lucide-react';
import { STORE } from '../lib/catalog';
import { DEMO_REVIEWS } from '../lib/store-profile';
import { useMenu } from '../lib/menu-admin';
import { Divider, RevealLines } from './reveal-text';
import { DishArt } from './dish-art';
import { DishEffects } from './dish-effects';
import { StoreMap } from './store-map';
import { Magnetic } from './magnetic';
import { FactsMarquee } from './marquee';
import { EASE, useMotionOK } from '../lib/motion';
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

  /**
   * The same depth, driven by the cursor instead of the wheel.
   *
   * -0.5 … 0.5 from the middle of the composition, springed so it trails the
   * pointer rather than snapping to it. Each layer reads a different
   * fraction of it — the furthest thing back moves least — which is the same
   * rule the scroll parallax above uses, just on the other axis. Horizontal
   * only: the vertical is already spoken for by scroll, and a layer
   * answering to both at once stops reading as depth and starts reading as
   * noise. Mouse only, for the reason Magnetic and Tilt are: a touch screen
   * has no hover to lean into, and a finger already covers the composition.
   */
  const pointerX = useMotionValue(0);
  const heroSpring = { stiffness: 55, damping: 16, mass: 0.5 };
  const sunPointerX = useSpring(useTransform(pointerX, (value) => value * 10), heroSpring);
  const platePointerX = useSpring(useTransform(pointerX, (value) => value * 22), heroSpring);
  const leafPointerX = useSpring(useTransform(pointerX, (value) => value * 34), heroSpring);

  const onHeroPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!motionOK || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
  };
  const onHeroPointerLeave = () => pointerX.set(0);

  /** A gentle, endless sway — steam, a leaf, a plate settled but not still. */
  const drift = (seconds: number, delay = 0) => (motionOK ? { duration: seconds, repeat: Infinity, ease: EASE.drift, delay } : { duration: 0 });

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
        <div className="hero-visual" aria-label="ภาพประกอบเมนูกะเพราหมูสับ ลาเต้ และครัวซองต์" onPointerMove={onHeroPointerMove} onPointerLeave={onHeroPointerLeave} onPointerCancel={onHeroPointerLeave}>
          <motion.div className="parallax-plane" style={{ y: sunY }}>
            <motion.div className="sun" style={{ x: sunPointerX }} animate={motionOK ? { scale: [1, 1.035, 1] } : { scale: 1 }} transition={drift(6)} />
          </motion.div>
          <motion.div className="parallax-plane" style={{ y: plateY }}>
            <motion.div className="plate plate-main" style={{ x: platePointerX, rotate: -7 }} animate={motionOK ? { y: [0, -8, 0] } : { y: 0 }} transition={drift(5)}><span role="img" aria-label="ข้าวกะเพราไข่ดาว">🍳</span><i>กะเพราหมูสับ</i></motion.div>
            <motion.div className="plate plate-side" style={{ x: platePointerX, rotate: -7 }} animate={motionOK ? { y: [0, -6, 0] } : { y: 0 }} transition={drift(4.2, 0.6)}><span role="img" aria-label="ลาเต้">☕</span><span className="steam hero-steam hero-steam-one" aria-hidden /><span className="steam hero-steam hero-steam-two" aria-hidden /></motion.div>
          </motion.div>
          <motion.div className="parallax-plane" style={{ y: leafY }}>
            <motion.div className="leaf leaf-one" style={{ x: leafPointerX }} animate={motionOK ? { rotate: [14, 22, 14] } : { rotate: 18 }} transition={drift(4.6)}>❧</motion.div>
            <motion.div className="leaf leaf-two" style={{ x: leafPointerX }} animate={motionOK ? { rotate: [164, 172, 164] } : { rotate: 168 }} transition={drift(5.4, 1.1)}>❧</motion.div>
          </motion.div>
          <div className="handwritten">made with<br /><b>ใจ</b></div>
        </div>
      </section>

      <section className="trust-bar" aria-label="จุดเด่นของร้าน">
        {[
          { icon: <UtensilsCrossed />, text: 'ปรุงสดทุกออเดอร์' },
          { icon: <Sparkles />, text: 'วัตถุดิบคัดสรร' },
          { icon: <PackageCheck />, text: 'รับที่ร้านหรือจัดส่ง' },
          { icon: <ShieldCheck />, text: 'ชำระเงินปลอดภัย' },
        ].map((item, index) => (
          <motion.span
            key={item.text}
            data-reveal
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: motionOK ? 0.4 : 0.01, delay: motionOK ? index * 0.07 : 0, ease: EASE.enter }}
          >
            {item.icon} {item.text}
          </motion.span>
        ))}
      </section>

      <FactsMarquee />

      <section className="menu-preview page-section">
        <div className="section-heading"><div><p className="eyebrow">IMJAI FAVOURITES</p><RevealLines as="h2" lines={['เมนูที่ใครมาก็คิดถึง']} /></div><div><p>คัดวัตถุดิบดี ปรุงสดใหม่<br />ในแบบที่อยากทำให้คนที่เรารักทาน</p><Link prefetch={false} className="section-link" href="/menu">ดูเมนูทั้งหมด <ArrowRight size={15} /></Link></div></div>
        <div className="menu-grid featured-grid">
          {favourites.map((item, index) => (
            <Tilt key={item.sku} strength={7} lift={12}><motion.article data-reveal className="menu-card" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }}>
              <Link prefetch={false} href={`/menu?item=${item.sku}`} className={`dish-illustration ${item.tone}`}>
                <DishEffects category={item.category} hot={item.hot} />
                {item.image ? (
                  <DishArt src={item.image} alt={item.name} sizes="(max-width: 900px) 50vw, 25vw" />
                ) : (
                  // A slow, phase-offset bob — an emoji tile with nothing
                  // asked of it before now was the one flat thing in a page
                  // that otherwise moves. Offset per card so four dishes
                  // don't bob in lockstep like a single wobbling sheet.
                  <motion.span
                    role="img"
                    aria-label={item.name}
                    animate={motionOK ? { y: [0, -6, 0], rotate: [0, 2, 0] } : { y: 0, rotate: 0 }}
                    transition={drift(3.4 + index * 0.35, index * 0.25)}
                  >
                    {item.emoji}
                  </motion.span>
                )}<small>{String(index + 1).padStart(2, '0')}</small>
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
        <div className="category-grid">
          {categories.map((category, index) => (
            <Tilt key={category.name} strength={4} lift={4} sheen={false}>
              <motion.div
                data-reveal
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: motionOK ? 0.42 : 0.01, delay: motionOK ? index * 0.07 : 0, ease: EASE.enter }}
              >
                <Link prefetch={false} href={category.href}>
                  <motion.span
                    animate={motionOK ? { y: [0, -4, 0] } : { y: 0 }}
                    transition={drift(3.2 + index * 0.3, index * 0.2)}
                  >
                    {category.icon}
                  </motion.span>
                  <div><b>{category.name}</b><small>{category.note}</small></div>
                  <ArrowRight />
                </Link>
              </motion.div>
            </Tilt>
          ))}
        </div>
      </section>

      <section className="promotion-band">
        <div className="promotion-art">
          {/* Entrance (outer, plays once on scroll-in) and idle bob (inner,
              loops forever after) are two separate elements on purpose —
              Motion's `animate` and `whileInView` fighting over the same
              element's transform is how an entrance silently stops
              finishing. */}
          <motion.span
            data-reveal
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '0px 0px -80px 0px' }}
            transition={{ duration: motionOK ? 0.55 : 0.01, ease: EASE.enter }}
          >
            <motion.span animate={motionOK ? { y: [0, -7, 0] } : { y: 0 }} transition={drift(3.6)} style={{ display: 'inline-block' }}>☕</motion.span>
          </motion.span>
          <motion.b
            data-reveal
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '0px 0px -80px 0px' }}
            transition={{ duration: motionOK ? 0.4 : 0.01, delay: motionOK ? 0.35 : 0, ease: EASE.enter }}
          >
            +
          </motion.b>
          <motion.span
            data-reveal
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '0px 0px -80px 0px' }}
            transition={{ duration: motionOK ? 0.55 : 0.01, delay: motionOK ? 0.1 : 0, ease: EASE.enter }}
          >
            <motion.span animate={motionOK ? { y: [0, -7, 0] } : { y: 0 }} transition={drift(4.1, 0.5)} style={{ display: 'inline-block' }}>🥐</motion.span>
          </motion.span>
        </div>
        <div><p className="eyebrow">A LITTLE HAPPINESS</p><h2>กาแฟหรือชา + เบเกอรี่<br /><em>ลดทันที 15 บาท</em></h2><p>เพียงใส่เมนูที่ร่วมรายการลงตะกร้า วันนี้–31 ส.ค. 2569</p><Magnetic><Link prefetch={false} className="primary-button" href="/menu">เลือกคู่โปรด <ArrowRight size={17} /></Link></Magnetic></div>
      </section>

      <section className="story-section" id="story">
        <motion.div
          className="story-art"
          data-reveal
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '0px 0px -100px 0px' }}
          transition={{ duration: motionOK ? 0.55 : 0.01, ease: EASE.enter }}
        >
          <motion.div className="story-circle" animate={motionOK ? { scale: [1, 1.04, 1] } : { scale: 1 }} transition={drift(5.5)}>อ</motion.div>
          <motion.span className="story-sprig" animate={motionOK ? { rotate: [-4, 4, -4] } : { rotate: 0 }} transition={drift(4.8)}>❧</motion.span>
          <small>SINCE 2026</small>
        </motion.div>
        <div><p className="eyebrow">OUR LITTLE STORY</p><RevealLines as="h2" lines={['ครัวเล็ก ๆ', 'ที่ตั้งใจทำให้ทุกคน', 'รู้สึกเหมือนได้กลับบ้าน']} /><p>“Home-Cooked Professionalism” คือความอบอุ่นแบบอาหารบ้าน ควบคู่กับมาตรฐานที่เราใส่ใจ ตั้งแต่วัตถุดิบจนถึงมือคุณ</p><div className="story-sign">ด้วยใจ — ทีมอิ่มใจ <Heart size={18} /></div></div>
      </section>

      <Divider />

      <section className="reviews-section page-section">
        <p className="eyebrow">WORDS FROM OUR GUESTS</p><RevealLines as="h2" lines={['ความอิ่มใจจากโต๊ะข้าง ๆ']} />
        {/* The badge is the whole point of keeping these: the section can show
            its shape without anyone reading invented praise as real. */}
        <p className="demo-badge">ตัวอย่างการแสดงผล · จะเปลี่ยนเป็นรีวิวจริงเมื่อเปิดร้าน</p>
        <div className="review-grid">
          {DEMO_REVIEWS.map((review, index) => (
            <motion.article
              key={review.name}
              data-reveal
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -60px 0px' }}
              transition={{ duration: motionOK ? 0.45 : 0.01, delay: motionOK ? index * 0.1 : 0, ease: EASE.enter }}
            >
              <Quote />
              <div className="stars" aria-hidden>★★★★★</div>
              <p>{review.quote}</p>
              <b>{review.name} · {review.context}</b>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="visit-section" id="location">
        <motion.div data-reveal initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '0px 0px -80px 0px' }} transition={{ duration: motionOK ? 0.5 : 0.01, ease: EASE.enter }}>
          <StoreMap className="visit-map" />
        </motion.div>
        <motion.div className="visit-copy" data-reveal initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -80px 0px' }} transition={{ duration: motionOK ? 0.5 : 0.01, delay: motionOK ? 0.1 : 0, ease: EASE.enter }}><p className="eyebrow">COME SAY HELLO</p><RevealLines as="h2" lines={['แวะมาพักใจ', 'แล้วทานอะไรอร่อย ๆ']} /><dl><div><dt><MapPin /></dt><dd><b>ที่ตั้งร้าน</b><span>{STORE.address}</span></dd></div><div><dt><Clock3 /></dt><dd><b>เวลาเปิด–ปิด</b><span>{STORE.hours}</span></dd></div></dl><a className="primary-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE.address)}`} target="_blank" rel="noreferrer">เปิดแผนที่ <ArrowRight size={17} /></a></motion.div>
      </section>
    </main>
  );
}
