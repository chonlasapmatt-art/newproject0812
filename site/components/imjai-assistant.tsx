'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Bot, Send, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { MENU_ITEMS, STORE } from '../lib/catalog';

type Message = { from: 'bot' | 'user'; text: string };

function safeReply(input: string) {
  const message = input.trim().toLowerCase();
  if (!message) return 'พิมพ์คำถามหรือเลือกหัวข้อด้านบนได้เลยค่ะ';
  if (message.includes('เวลา') || message.includes('เปิด')) return `ร้านเปิด ${STORE.hours} ค่ะ`;
  if (message.includes('แพ้') || message.includes('allerg')) return 'แจ้งชื่อเมนูที่สนใจได้เลยค่ะ น้องอิ่มใจจะช่วยดูสารก่อภูมิแพ้จากข้อมูลเมนู แต่กรณีแพ้รุนแรงแนะนำให้โทรยืนยันกับร้านก่อนสั่งนะคะ';
  if (message.includes('งบ') || /\d+/.test(message)) {
    const budget = Number(message.match(/\d+/)?.[0] ?? 100);
    const picks = MENU_ITEMS.filter((item) => item.available && item.price <= budget).slice(0, 3).map((item) => item.name);
    return picks.length ? `งบประมาณ ฿${budget} ลอง ${picks.join(' หรือ ')} ได้เลยค่ะ` : 'งบนี้ยังไม่ถึงยอดขั้นต่ำสำหรับสั่งออนไลน์ แนะนำเพิ่มเครื่องดื่มอีกสักแก้วนะคะ';
  }
  if (message.includes('แนะนำ') || message.includes('อร่อย')) return 'ถ้าอยากอิ่มท้อง แนะนำกะเพราหมูสับไข่ดาวค่ะ ถ้าจิบสบาย ๆ เลือกลาเต้คู่ครัวซองต์ ลด 15 บาทพอดีเลย';
  if (message.includes('ออเดอร์') || message.includes('สถานะ')) return 'ตรวจสอบสถานะได้ที่หน้า “ติดตามออเดอร์” โดยใช้เลขออเดอร์และเบอร์โทรค่ะ น้องอิ่มใจจะไม่เปิดเผยข้อมูลออเดอร์หากข้อมูลไม่ตรงกัน';
  return 'น้องอิ่มใจช่วยแนะนำเมนู เวลาเปิดร้าน สารก่อภูมิแพ้ และวิธีติดตามออเดอร์ได้ค่ะ หากต้องการคุยกับพนักงาน โทร 02-123-4567 ได้เลย';
}

export function ImJaiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ from: 'bot', text: 'สวัสดีค่ะ น้องอิ่มใจช่วยเลือกเมนูให้ได้นะคะ 🌿' }]);

  const send = (text: string) => {
    const cleaned = text.trim().slice(0, 240);
    if (!cleaned) return;
    setMessages((items) => [...items, { from: 'user', text: cleaned }, { from: 'bot', text: safeReply(cleaned) }]);
    setInput('');
  };
  const submit = (event: FormEvent) => { event.preventDefault(); send(input); };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section className="assistant-panel" aria-label="น้องอิ่มใจ ผู้ช่วยร้านอาหาร" initial={{ opacity: 0, y: 18, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .97 }}>
            <header><div className="assistant-avatar"><Bot /></div><div><b>น้องอิ่มใจ</b><span><i /> พร้อมช่วยแนะนำเมนู</span></div><button onClick={() => setOpen(false)} aria-label="ปิดผู้ช่วย"><X /></button></header>
            <div className="assistant-quick"><button onClick={() => send('แนะนำเมนู')}>แนะนำเมนู</button><button onClick={() => send('งบ 100 บาท')}>งบ ฿100</button><button onClick={() => send('ร้านเปิดกี่โมง')}>เวลาเปิดร้าน</button></div>
            <div className="assistant-messages" aria-live="polite">{messages.slice(-8).map((message, index) => <p className={message.from} key={`${message.from}-${index}`}>{message.text}</p>)}</div>
            <form onSubmit={submit}><label className="sr-only" htmlFor="assistant-input">พิมพ์คำถาม</label><input id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={240} placeholder="อยากทานอะไรดี..." /><button aria-label="ส่งข้อความ"><Send size={17} /></button></form>
            <small>ผู้ช่วยไม่สามารถแก้ราคา ยืนยันการชำระเงิน หรือสร้างออเดอร์แทนคุณ</small>
          </motion.section>
        )}
      </AnimatePresence>
      <button className="assistant-fab" onClick={() => setOpen(!open)} aria-label="เปิดแชทกับน้องอิ่มใจ"><Bot /><span>ถามน้องอิ่มใจ</span></button>
    </>
  );
}
