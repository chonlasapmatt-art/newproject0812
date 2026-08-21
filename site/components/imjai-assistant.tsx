'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Bot, Plus, Send, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { MenuItem } from '../lib/catalog';
import { answer, greeting, OPENING_CHIPS, type Answer } from '../lib/imjai-brain';
import { EASE, useMotionOK } from '../lib/motion';
import { useMenu } from '../lib/menu-admin';
import { ordersForAccount, useOrders } from '../lib/orders';
import { useSession } from '../lib/session';
import { useAddToCart } from '../lib/add-to-cart';

/**
 * น้องอิ่มใจ — the shop assistant.
 *
 * The answers come from lib/imjai-brain, which only ever reads the shop's own
 * data. This file is the manners: a pause before replying so a wall of text
 * does not appear mid-keystroke, dish cards the customer can act on without
 * retyping a name, and follow-up chips that change with the answer instead of
 * repeating the same three forever.
 *
 * Adding from here goes through the same useAddToCart as every other button,
 * so a guest tapping "ใส่ตะกร้า" in the chat is sent to sign in and comes back
 * to their dish exactly as they would from the menu grid.
 */

type ChatMessage =
  | { id: string; from: 'user'; text: string; at: number }
  | { id: string; from: 'bot'; reply: Answer; at: number };

const clock = (at: number) =>
  new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

/** Long answers get a slightly longer pause — it reads as thinking, not lag. */
const thinkingTime = (text: string) => Math.min(260 + text.length * 5, 900);

function DishCard({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) {
  const needsChoices = Boolean(item.options?.length);
  return (
    <article className="chat-dish">
      <span className={`chat-dish-art ${item.tone}`}>{item.emoji}</span>
      <div>
        <b>{item.name}</b>
        <small>฿{item.price}{item.stock <= 5 ? ` · เหลือ ${item.stock}` : ''}</small>
      </div>
      {needsChoices ? (
        // Sweetness and temperature are the customer's call, so a drink opens
        // its sheet rather than landing in the basket with defaults.
        <Link prefetch={false} className="chat-dish-open" href={`/menu?item=${item.sku}`}>
          เลือก <ArrowUpRight size={13} />
        </Link>
      ) : (
        <button type="button" className="chat-dish-add" onClick={() => onAdd(item)}>
          <Plus size={13} /> ใส่ตะกร้า
        </button>
      )}
    </article>
  );
}

export function ImJaiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const session = useSession();
  const menu = useMenu();
  const orders = useOrders();
  const addToCart = useAddToCart();
  const motionOK = useMotionOK();

  const streamRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);

  const context = useMemo(
    () => ({
      menu,
      // Scoped to the signed-in account, so the assistant physically cannot
      // read out an order that belongs to somebody else.
      orders: ordersForAccount(orders, session.user?.email),
      signedIn: session.status === 'signed-in',
      customerName: session.user?.name ?? null,
    }),
    [menu, orders, session.status, session.user?.email, session.user?.name],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, 240);
      if (!text) return;
      const at = Date.now();
      setMessages((current) => [...current, { id: `u-${at}`, from: 'user', text, at }]);
      setInput('');
      setTyping(true);

      const reply = answer(text, context);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setTyping(false);
        setMessages((current) => [...current, { id: `b-${Date.now()}`, from: 'bot', reply, at: Date.now() }]);
      }, motionOK ? thinkingTime(reply.text) : 0);
    },
    [context, motionOK],
  );

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  /**
   * Typing into a panel you just opened should not need a second tap. The
   * focus lives in a ref callback rather than an effect because it belongs to
   * the element appearing, not to a state change — and it fires once per open,
   * so a re-render mid-conversation cannot steal the caret back.
   */
  const focused = useRef(false);
  const focusInput = useCallback((node: HTMLInputElement | null) => {
    if (!node || focused.current) return;
    focused.current = true;
    node.focus();
  }, []);

  // A new message should be the one you are looking at.
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.scrollTo({ top: stream.scrollHeight, behavior: motionOK ? 'smooth' : 'auto' });
  }, [messages, typing, motionOK]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const welcome: Answer = useMemo(
    () => ({ intent: 'greeting', text: greeting(session.user?.name), chips: OPENING_CHIPS }),
    [session.user?.name],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  const onAdd = (item: MenuItem) => {
    const result = addToCart({
      sku: item.sku,
      name: item.name,
      unitPrice: item.price,
      quantity: 1,
      addOns: [],
      emoji: item.emoji,
    });
    if (result === 'needs-account') setOpen(false);
  };

  // The chips under the newest reply; the ones above it are history.
  const lastBot = [...messages].reverse().find((message) => message.from === 'bot');
  const latest = lastBot?.from === 'bot' ? lastBot.reply : welcome;
  const chips = (typing ? undefined : latest.chips) ?? [];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            className="assistant-panel"
            aria-label="น้องอิ่มใจ ผู้ช่วยร้านอาหาร"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: motionOK ? 0.24 : 0.01, ease: EASE.enter }}
          >
            <header>
              <div className="assistant-avatar"><Bot /></div>
              <div>
                <b>น้องอิ่มใจ</b>
                <span><i /> ตอบจากเมนูและสต็อกจริงของร้าน</span>
              </div>
              <button type="button" onClick={() => { focused.current = false; setOpen(false); }} aria-label="ปิดผู้ช่วย"><X /></button>
            </header>

            <div className="assistant-messages" ref={streamRef} aria-live="polite">
              <div className="chat-row bot">
                <p className="chat-bubble bot">{welcome.text}</p>
              </div>

              {messages.map((message) =>
                message.from === 'user' ? (
                  <div className="chat-row user" key={message.id}>
                    <p className="chat-bubble user">{message.text}</p>
                    <time>{clock(message.at)}</time>
                  </div>
                ) : (
                  <div className="chat-row bot" key={message.id}>
                    <p className="chat-bubble bot">{message.reply.text}</p>
                    {!!message.reply.dishes?.length && (
                      <div className="chat-dishes">
                        {message.reply.dishes.map((item) => (
                          <DishCard key={item.sku} item={item} onAdd={onAdd} />
                        ))}
                      </div>
                    )}
                    {message.reply.link && (
                      message.reply.link.href.startsWith('http') ? (
                        <a className="chat-link" href={message.reply.link.href} target="_blank" rel="noreferrer">
                          {message.reply.link.label} <ArrowUpRight size={14} />
                        </a>
                      ) : (
                        <Link prefetch={false} className="chat-link" href={message.reply.link.href} onClick={() => setOpen(false)}>
                          {message.reply.link.label} <ArrowUpRight size={14} />
                        </Link>
                      )
                    )}
                    <time>{clock(message.at)}</time>
                  </div>
                ),
              )}

              {typing && (
                <div className="chat-row bot">
                  <p className="chat-bubble bot typing" aria-label="น้องอิ่มใจกำลังพิมพ์">
                    <i /><i /><i />
                  </p>
                </div>
              )}
            </div>

            {chips.length > 0 && (
              <div className="assistant-quick">
                {chips.map((chip) => (
                  <button type="button" key={chip} onClick={() => send(chip)}>{chip}</button>
                ))}
              </div>
            )}

            <form onSubmit={submit}>
              <label className="sr-only" htmlFor="assistant-input">พิมพ์คำถาม</label>
              <input
                id="assistant-input"
                ref={focusInput}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={240}
                autoComplete="off"
                placeholder="ถามได้เลย เช่น งบ 150 กินอะไรดี"
              />
              <button aria-label="ส่งข้อความ" disabled={!input.trim()}><Send size={17} /></button>
            </form>

            <small>ผู้ช่วยไม่สามารถแก้ราคา ยืนยันการชำระเงิน หรือสร้างออเดอร์แทนคุณได้</small>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        className={`assistant-fab ${open ? 'is-open' : ''}`}
        onClick={() => { focused.current = false; setOpen((value) => !value); }}
        aria-expanded={open}
        aria-label={open ? 'ปิดแชทกับน้องอิ่มใจ' : 'เปิดแชทกับน้องอิ่มใจ'}
      >
        {open ? <X /> : <Sparkles />}
        <span>{open ? 'ปิดแชท' : 'ถามน้องอิ่มใจ'}</span>
      </button>
    </>
  );
}
