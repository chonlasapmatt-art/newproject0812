'use client';

import { motion } from 'motion/react';
import { Bike, Clock3, MapPin, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { DURATION, EASE, useMotionOK } from '../lib/motion';
import { STORE_PROFILE } from '../lib/store-profile';
import { Tilt } from './tilt';

/**
 * About — where the shop is, when it is open, and what it is trying to be.
 *
 * The facts a customer needs before leaving the house come first; the story
 * comes after, because nobody reads a founding story while deciding whether
 * the kitchen is still open.
 */

const { location, hours, service, story, tagline, nameTh } = STORE_PROFILE;

const FACTS = [
  { icon: Clock3, label: 'เปิดทุกวัน', value: hours.everyday, hint: `ครัวปิดรับ ${hours.kitchenLastOrder}` },
  { icon: UtensilsCrossed, label: 'ปรุงเสร็จใน', value: service.prepMinutes, hint: 'นับจากร้านรับออเดอร์' },
  { icon: Bike, label: 'ส่งฟรีเมื่อสั่งครบ', value: `฿${service.freeDeliveryAt}`, hint: `ต่ำกว่านั้นค่าส่ง ฿${service.deliveryFee}` },
  { icon: MapPin, label: 'สั่งขั้นต่ำ', value: `฿${service.minimumOrder}`, hint: 'ทั้งรับที่ร้านและจัดส่ง' },
];

export function AboutPage() {
  const motionOK = useMotionOK();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: motionOK ? DURATION.slow : 0.01, ease: EASE.enter, delay: motionOK ? delay : 0 },
  });

  return (
    <main className="about-page">
      <header className="page-hero compact">
        <p className="eyebrow">เกี่ยวกับเรา</p>
        <h1>{nameTh}</h1>
        <p>{tagline}</p>
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
            <div className="place-map" aria-hidden>
              <span className="place-road place-road-a" />
              <span className="place-road place-road-b" />
              <span className="place-pin"><MapPin size={17} /></span>
            </div>
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

      <motion.section {...rise(0.08)} data-reveal className="about-story">
        <p className="eyebrow">ตั้งแต่ปี {story.since}</p>
        {story.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <p className="about-sign">ด้วยใจ — ทีมอิ่มใจ</p>
      </motion.section>
    </main>
  );
}
