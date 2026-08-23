'use client';

import { motion } from 'motion/react';
import { Clock3, MapPin, MessageCircle, Phone } from 'lucide-react';
import { DURATION, EASE, useMotionOK } from '../lib/motion';
import { lineBasicId, lineChatUrl } from '../lib/line-oa';
import { CONTACT_CHANNELS, STORE_PROFILE } from '../lib/store-profile';
import { useStoreSettings } from '../lib/store-settings';
import { ImJaiMark } from './brand-logo';
import { Tilt } from './tilt';

/**
 * Contact — the page a customer opens when something has gone wrong, or when
 * they want a person rather than a form.
 *
 * LINE leads because it is where the shop actually replies. Everything else is
 * a fallback, and the owner is named so the customer knows who they are
 * talking to rather than writing into a void.
 */

const ICONS: Record<string, typeof Phone> = {
  line: MessageCircle,
  phone: Phone,
  address: MapPin,
};

export function ContactPage() {
  const motionOK = useMotionOK();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: motionOK ? DURATION.slow : 0.01, ease: EASE.enter, delay: motionOK ? delay : 0 },
  });

  const line = CONTACT_CHANNELS.find((channel) => channel.id === 'line');

  // The address wraps to several lines while the others fit on one, so it goes
  // last and spans two columns. Left in source order it stretched its whole row
  // and left a hole beside the short cards.
  const settings = useStoreSettings();
  const liveLineUrl = lineChatUrl(settings.lineOaId, settings.lineOaLink);
  const quickChannels = CONTACT_CHANNELS.filter((channel) => channel.id !== 'address');
  const address = CONTACT_CHANNELS.find((channel) => channel.id === 'address');

  return (
    <main className="contact-page">
      <header className="page-hero compact">
        <p className="eyebrow">ติดต่อเรา</p>
        <h1>คุยกับเราได้เลย</h1>
        <p>มีคำถามเรื่องเมนู ออเดอร์ หรืออยากสั่งจำนวนมาก ทักมาได้ทุกช่องทาง</p>
      </header>

      <section className="contact-grid">
        <motion.div {...rise(0)} data-reveal className="contact-owner-wrap">
          <Tilt strength={5} lift={12}>
            <article className="contact-owner">
              <ImJaiMark size={54} title={null} />
              <div>
                <p className="eyebrow">{STORE_PROFILE.owner.role}</p>
                <h2>{STORE_PROFILE.owner.name}</h2>
                <p>{STORE_PROFILE.owner.note}</p>
              </div>
            </article>
          </Tilt>
        </motion.div>

        {quickChannels.map((channel, index) => {
          const Icon = ICONS[channel.id] ?? MessageCircle;
          // The shop edits its LINE account in the dashboard, so this card
          // shows what they saved rather than what the build was given.
          const live = channel.id === 'line' && liveLineUrl
            ? { ...channel, value: lineBasicId(settings.lineOaId) || channel.value, href: liveLineUrl, placeholder: false }
            : channel;
          const body = (
            <article className={`contact-card ${live.id === 'line' ? 'is-primary' : ''}`}>
              <span className="contact-icon" aria-hidden><Icon size={21} /></span>
              <div>
                <p className="contact-label">{live.label}</p>
                <b className="contact-value">{live.value}</b>
                {live.hint && <small>{live.hint}</small>}
              </div>
            </article>
          );

          return (
            <motion.div {...rise(0.06 * (index + 1))} data-reveal key={channel.id}>
              <Tilt strength={7} lift={10}>
                {live.href ? (
                  <a
                    className="contact-link"
                    href={live.href}
                    {...(live.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {body}
                  </a>
                ) : (
                  body
                )}
              </Tilt>
            </motion.div>
          );
        })}

        <motion.div {...rise(0.24)} data-reveal>
          <Tilt strength={5} lift={8} sheen={false}>
            <article className="contact-card contact-hours">
              <span className="contact-icon" aria-hidden><Clock3 size={21} /></span>
              <div>
                <p className="contact-label">เวลาทำการ</p>
                <b className="contact-value">{STORE_PROFILE.hours.everyday}</b>
                <small>ครัวรับออเดอร์สุดท้าย {STORE_PROFILE.hours.kitchenLastOrder} · {STORE_PROFILE.hours.note}</small>
              </div>
            </article>
          </Tilt>
        </motion.div>

        {address && (
          <motion.div {...rise(0.3)} data-reveal className="contact-address-wrap">
            <Tilt strength={5} lift={8} sheen={false}>
              <article className="contact-card">
                <span className="contact-icon" aria-hidden><MapPin size={21} /></span>
                <div>
                  <p className="contact-label">{address.label}</p>
                  <b className="contact-value">{address.value}</b>
                  {address.hint && <small>{address.hint}</small>}
                </div>
              </article>
            </Tilt>
          </motion.div>
        )}
      </section>

      {line?.href && (
        <motion.section {...rise(0.1)} data-reveal className="contact-cta">
          <div>
            <h2>ทักไลน์เร็วที่สุด</h2>
            <p>แอดมินตอบเองในเวลาทำการ ส่งรูปเมนูหรือสลิปได้เลย</p>
          </div>
          <a className="primary-button" href={line.href} target="_blank" rel="noreferrer">
            <MessageCircle size={18} /> เปิดแชท LINE
          </a>
        </motion.section>
      )}
    </main>
  );
}
