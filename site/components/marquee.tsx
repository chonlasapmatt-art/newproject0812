'use client';

import { STORE } from '../lib/catalog';
import { STORE_PROFILE } from '../lib/store-profile';
import { useMotionOK } from '../lib/motion';

/**
 * The strip of standing facts that runs between the hero and the menu.
 *
 * It carries the four things a customer checks before deciding to order —
 * hours, minimum, free delivery, how the food is made — rather than the words
 * a designer would put there. A ribbon of adjectives scrolling past is
 * decoration; this is the same information the shop would paint on its window.
 *
 * The track holds the list twice and travels exactly half its width, which is
 * what makes the loop seamless: at the end of the cycle the second copy sits
 * exactly where the first started. The duplicate is hidden from assistive
 * technology so the facts are announced once.
 */

const facts = [
  'ปรุงสดใหม่ทุกจาน',
  `เปิดทุกวัน ${STORE_PROFILE.hours.everyday}`,
  `ส่งฟรีเมื่อครบ ฿${STORE.freeDeliveryAt}`,
  `ยอดขั้นต่ำ ฿${STORE.minimumOrder}`,
  'เบเกอรี่อบใหม่ทุกเช้า',
  `รับที่ร้าน ${STORE_PROFILE.service.prepMinutes}`,
];

function Run({ hidden }: { hidden?: boolean }) {
  return (
    <div className="marquee-run" aria-hidden={hidden || undefined}>
      {facts.map((fact) => (
        <span className="marquee-item" key={fact}>
          <i className="marquee-dot" aria-hidden />
          {fact}
        </span>
      ))}
    </div>
  );
}

export function FactsMarquee() {
  const motionOK = useMotionOK();

  return (
    <section className="marquee-strip" aria-label="ข้อมูลร้านโดยย่อ">
      {/* Standing still, the strip is a readable row of facts rather than a
          broken animation — which is the right thing for reduced motion. */}
      <div className={`marquee-track ${motionOK ? 'is-running' : ''}`}>
        <Run />
        <Run hidden />
      </div>
    </section>
  );
}
