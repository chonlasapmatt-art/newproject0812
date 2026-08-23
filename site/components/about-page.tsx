'use client';

import { motion } from 'motion/react';
import { Bike, Clock3, Heart, MapPin, Sparkles, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { DURATION, EASE, useMotionOK } from '../lib/motion';
import { STORE_PROFILE } from '../lib/store-profile';
import { ImJaiMark } from './brand-logo';
import { RevealLines } from './reveal-text';
import { StoreMap } from './store-map';
import { Tilt } from './tilt';

/**
 * About — where the shop is, when it is open, and what it is trying to be.
 *
 * The facts a customer needs before leaving the house come first; the story
 * comes after, because nobody reads a founding story while deciding whether
 * the kitchen is still open.
 */

const { location, hours, service, story, owner, tagline, nameTh } = STORE_PROFILE;

const FACTS = [
  { icon: Clock3, label: 'เปิดทุกวัน', value: hours.everyday, hint: `ครัวปิดรับ ${hours.kitchenLastOrder}` },
  { icon: UtensilsCrossed, label: 'ปรุงเสร็จใน', value: service.prepMinutes, hint: 'นับจากร้านรับออเดอร์' },
  { icon: Bike, label: 'ส่งฟรีเมื่อสั่งครบ', value: `฿${service.freeDeliveryAt}`, hint: `ต่ำกว่านั้นค่าส่ง ฿${service.deliveryFee}` },
  { icon: MapPin, label: 'สั่งได้ตั้งแต่', value: '1 ชิ้น', hint: 'ไม่มียอดขั้นต่ำ' },
];

/** Already said elsewhere on the site (the home page's story, the trust bar)
 *  — repeated here as a row of chips rather than invented fresh for this page. */
const VALUES = [
  { icon: UtensilsCrossed, text: 'ปรุงสดใหม่ทุกจาน' },
  { icon: Sparkles, text: 'เลือกวัตถุดิบเอง' },
  { icon: Heart, text: 'ตั้งใจเหมือนทำให้คนที่รัก' },
];

export function AboutPage() {
  const motionOK = useMotionOK();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: motionOK ? DURATION.slow : 0.01, ease: EASE.enter, delay: motionOK ? delay : 0 },
  });
  /** A gentle, endless sway — the same idle vocabulary the home page uses. */
  const drift = (seconds: number, delay = 0) => (motionOK ? { duration: seconds, repeat: Infinity, ease: EASE.drift, delay } : { duration: 0 });

  return (
    <main className="about-page">
      <header className="about-hero">
        <div className="about-hero-copy">
          <p className="eyebrow">เกี่ยวกับเรา</p>
          <RevealLines as="h1" lines={[nameTh]} />
          <p>{tagline}</p>
          <div className="about-values">
            {VALUES.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.span
                  key={value.text}
                  data-reveal
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: motionOK ? 0.4 : 0.01, delay: motionOK ? 0.35 + index * 0.08 : 0, ease: EASE.enter }}
                >
                  <Icon size={14} /> {value.text}
                </motion.span>
              );
            })}
          </div>
        </div>
        <motion.div
          className="about-hero-emblem"
          data-reveal
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: motionOK ? DURATION.slow : 0.01, ease: EASE.enter }}
        >
          <motion.span className="about-emblem-ring" aria-hidden animate={motionOK ? { rotate: 360 } : { rotate: 0 }} transition={motionOK ? { duration: 48, repeat: Infinity, ease: 'linear' } : { duration: 0 }} />
          <motion.div className="about-emblem-core" animate={motionOK ? { scale: [1, 1.035, 1] } : { scale: 1 }} transition={drift(5.2)}>
            <ImJaiMark size={56} title={null} />
          </motion.div>
          <span className="about-emblem-since">SINCE {story.since}</span>
          <motion.span className="about-emblem-leaf" aria-hidden animate={motionOK ? { rotate: [-8, 8, -8] } : { rotate: 0 }} transition={drift(4.4)}>❧</motion.span>
        </motion.div>
      </header>

      <section className="fact-grid">
        {FACTS.map((fact, index) => {
          const Icon = fact.icon;
          return (
            <motion.div {...rise(index * 0.06)} data-reveal key={fact.label}>
              <Tilt strength={8} lift={10}>
                <article className="fact-card">
                  <span className="fact-icon" aria-hidden><Icon size={20} /></span>
                  <p className="fact-label">{fact.label}</p>
                  <b className="fact-value">{fact.value}</b>
                  <small>{fact.hint}</small>
                </article>
              </Tilt>
            </motion.div>
          );
        })}
      </section>

      <motion.section {...rise(0)} data-reveal className="about-place">
        <Tilt strength={4} lift={8} sheen={false}>
          <article className="place-card">
            <StoreMap className="place-map" />
            <div className="place-copy">
              <p className="eyebrow">ที่ตั้งร้าน</p>
              <h2>แวะมาทานที่ร้านได้</h2>
              <address>{location.address}</address>
              <p className="place-hint">{location.landmark}</p>
              <Link prefetch={false} className="primary-button" href="/menu">ดูเมนูก่อนมา</Link>
            </div>
          </article>
        </Tilt>
      </motion.section>

      <section className="about-story">
        <motion.div
          className="about-story-emblem"
          data-reveal
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: motionOK ? DURATION.slow : 0.01, ease: EASE.enter }}
        >
          <div className="story-avatar" aria-hidden>{owner.name.slice(0, 1)}</div>
        </motion.div>
        <div className="about-story-copy">
          <p className="eyebrow">ตั้งแต่ปี {story.since}</p>
          {story.body.map((paragraph, index) => (
            <motion.p
              key={paragraph}
              data-reveal
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: motionOK ? DURATION.base : 0.01, delay: motionOK ? index * 0.12 : 0, ease: EASE.enter }}
            >
              {paragraph}
            </motion.p>
          ))}
          <motion.div
            className="about-owner-line"
            data-reveal
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: motionOK ? DURATION.base : 0.01, delay: motionOK ? 0.3 : 0, ease: EASE.enter }}
          >
            <b>{owner.name}</b>
            <span>{owner.role}</span>
          </motion.div>
          <p className="about-sign">ด้วยใจ — ทีมอิ่มใจ <Heart size={16} /></p>
        </div>
      </section>
    </main>
  );
}
