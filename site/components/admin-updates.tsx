'use client';

import { CircleDot, Clock3, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  KIND_LABEL,
  ROADMAP,
  SHIPPED,
  STAGE_LABEL,
  type Stage,
} from '../lib/changelog';

/**
 * What changed, and what is coming.
 *
 * The shop asked for this after a run of changes they only heard about in a
 * chat window. They are the one a customer asks when the site looks different,
 * so the answer belongs somewhere they already open — not in a message thread
 * they would have to scroll back through.
 *
 * The roadmap sits on the same screen on purpose. Half of what is listed there
 * is waiting on something only the shop can hand over — a LINE OA id, a
 * webhook URL, an API key — and naming that next to the item is what turns a
 * wish list into something they can act on.
 */

const STAGES: Stage[] = ['next', 'later'];

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

export function AdminUpdates() {
  const [view, setView] = useState<'shipped' | 'roadmap'>('shipped');

  return (
    <section className="updates-panel">
      <header className="updates-head">
        <div>
          <h2>อัปเดตเว็บไซต์</h2>
          <p>ทุกอย่างที่เปลี่ยนบนเว็บจะมาขึ้นที่นี่ ไม่ต้องถามว่าอะไรขยับไปบ้าง</p>
        </div>
        <div className="updates-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'shipped'}
            className={view === 'shipped' ? 'active' : ''}
            onClick={() => setView('shipped')}
          >
            <Sparkles size={15} /> ขึ้นเว็บแล้ว <b>{SHIPPED.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'roadmap'}
            className={view === 'roadmap' ? 'active' : ''}
            onClick={() => setView('roadmap')}
          >
            <Clock3 size={15} /> กำลังจะทำ <b>{ROADMAP.length}</b>
          </button>
        </div>
      </header>

      {view === 'shipped' ? (
        <ol className="change-list">
          {SHIPPED.map((change) => (
            <li key={`${change.date}-${change.title}`}>
              <div className="change-when">
                <time dateTime={change.date}>{thaiDate(change.date)}</time>
                <span className={`change-kind kind-${change.kind}`}>{KIND_LABEL[change.kind]}</span>
              </div>
              <div className="change-what">
                <b>{change.title}</b>
                <p>{change.detail}</p>
                <small><CircleDot size={12} /> {change.where}</small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="roadmap">
          {STAGES.map((stage) => {
            const items = ROADMAP.filter((entry) => entry.stage === stage);
            if (!items.length) return null;
            return (
              <div className="roadmap-stage" key={stage}>
                <h3>{STAGE_LABEL[stage]}</h3>
                <ul>
                  {items.map((entry) => (
                    <li key={entry.title}>
                      <b>{entry.title}</b>
                      <p>{entry.detail}</p>
                      {entry.needs && <small>ต้องการจากร้าน: {entry.needs}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
