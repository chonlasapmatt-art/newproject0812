import { CATEGORIES, STORE, type MenuCategory, type MenuItem } from './catalog';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type StoredOrder } from './orders';
import { SHOP_LINE, SHOP_PHONE, STORE_PROFILE } from './store-profile';

/**
 * What น้องอิ่มใจ actually knows.
 *
 * This is deliberately not a language model. Everything the assistant says is
 * computed from the shop's own data — the live menu with the staff's stock and
 * price edits already folded in, the store profile, and the asking customer's
 * own orders. That means it cannot invent a dish, quote a price that is not on
 * the menu, or promise an opening time nobody set. When it does not know, it
 * says so and hands over to a person.
 *
 * Three things it must never do, because they belong to systems that check
 * their own inputs: change a price, confirm a payment, or place an order.
 *
 * The whole module is a pure function of (question, context), so every answer
 * below is testable without a browser.
 */

export type Intent =
  | 'greeting'
  | 'thanks'
  | 'recommend'
  | 'menu-search'
  | 'budget'
  | 'dietary'
  | 'hours'
  | 'location'
  | 'contact'
  | 'delivery'
  | 'payment'
  | 'order-status'
  | 'promotion'
  | 'how-to-order'
  | 'human'
  | 'unknown';

export type Answer = {
  intent: Intent;
  text: string;
  /** Rendered as tappable cards under the reply. */
  dishes?: MenuItem[];
  /** Follow-up questions worth one tap. */
  chips?: string[];
  link?: { href: string; label: string };
};

export type BrainContext = {
  /** The menu as customers currently see it, staff edits included. */
  menu: MenuItem[];
  /** Only the asking customer's own orders — never anybody else's. */
  orders: StoredOrder[];
  signedIn: boolean;
  customerName?: string | null;
};

const baht = (value: number) => `฿${value.toLocaleString('th-TH')}`;

/** Thai digits appear in typed input often enough to be worth normalising. */
function normalise(text: string) {
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  return text
    .replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)))
    .toLocaleLowerCase('th')
    .trim();
}

/* ------------------------------------------------------------------ *
 * Constraints — read out of the sentence regardless of what was asked
 * ------------------------------------------------------------------ */

const ALLERGEN_WORDS: { allergen: string; words: string[] }[] = [
  { allergen: 'นม', words: ['นม', 'แลคโตส', 'lactose', 'dairy', 'ชีส'] },
  { allergen: 'ไข่', words: ['ไข่', 'egg'] },
  { allergen: 'กลูเตน', words: ['กลูเตน', 'แป้งสาลี', 'gluten'] },
  { allergen: 'กุ้ง', words: ['กุ้ง', 'ทะเล', 'ซีฟู้ด', 'shrimp', 'seafood'] },
  { allergen: 'ถั่วเหลือง', words: ['ถั่ว', 'soy'] },
];

const AVOID_MARKERS = ['แพ้', 'ไม่กิน', 'ไม่ทาน', 'ไม่เอา', 'ไม่ใส่', 'งด', 'ไม่มี', 'no ', 'ไม่ได้'];

export type Constraints = {
  budget: number | null;
  avoid: string[];
  category: MenuCategory | null;
  /** True when they asked for something not spicy. */
  mild: boolean;
};

const CATEGORY_WORDS: { category: MenuCategory; words: string[] }[] = [
  { category: 'coffee', words: ['กาแฟ', 'ลาเต้', 'อเมริกาโน', 'คาปู', 'มอคค่า', 'espresso', 'coffee', 'latte'] },
  { category: 'non-coffee', words: ['ชาไทย', 'ชาเย็น', 'ชาเขียว', 'ชานม', 'มัทฉะ', 'สมูทตี้', 'โซดา', 'น้ำผลไม้', 'เครื่องดื่ม', 'ไม่มีคาเฟอีน'] },
  { category: 'food', words: ['ข้าว', 'อาหาร', 'ของคาว', 'จานหลัก', 'เส้น', 'สปาเก็ตตี้', 'แซนวิช', 'ต้มยำ'] },
  { category: 'dessert', words: ['ขนม', 'เค้ก', 'เบเกอรี่', 'ของหวาน', 'ครัวซอง', 'หวาน ๆ', 'dessert'] },
];

export function readConstraints(input: string): Constraints {
  const text = normalise(input);

  // "งบ 150", "ไม่เกิน 80", "100 บาท" — the number nearest a money word wins.
  let budget: number | null = null;
  const moneyMatch = text.match(/(?:งบ|ไม่เกิน|ภายใน|ราคา|under)\s*(\d{2,4})|(\d{2,4})\s*(?:บาท|฿|baht)/);
  if (moneyMatch) budget = Number(moneyMatch[1] ?? moneyMatch[2]);

  // An allergen only counts as a constraint when the sentence is avoiding it —
  // "แพ้นม" filters milk out, "ลาเต้ใส่นมอะไร" is a question about milk.
  const avoiding = AVOID_MARKERS.some((marker) => text.includes(marker));
  const avoid = avoiding
    ? ALLERGEN_WORDS.filter((entry) => entry.words.some((word) => text.includes(word))).map((entry) => entry.allergen)
    : [];

  const category = CATEGORY_WORDS.find((entry) => entry.words.some((word) => text.includes(word)))?.category ?? null;
  const mild = /ไม่เผ็ด|เผ็ดน้อย|ทานเผ็ดไม่ได้|กินเผ็ดไม่ได้/.test(text);

  return { budget, avoid: [...new Set(avoid)], category, mild };
}

const SPICY_SKUS = new Set(['FD-01', 'FD-05']);

export function filterMenu(menu: MenuItem[], constraints: Constraints) {
  return menu.filter((item) => {
    if (!item.available) return false;
    if (constraints.budget !== null && item.price > constraints.budget) return false;
    if (constraints.category && item.category !== constraints.category) return false;
    if (constraints.mild && SPICY_SKUS.has(item.sku)) return false;
    return !constraints.avoid.some((allergen) => item.allergens.includes(allergen));
  });
}

/** Chef's picks first, then the shop's featured dishes, then the rest. */
const byPreference = (a: MenuItem, b: MenuItem) =>
  Number(Boolean(b.chefChoice)) - Number(Boolean(a.chefChoice)) ||
  Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
  a.price - b.price;

/* ------------------------------------------------------------------ *
 * Intent
 * ------------------------------------------------------------------ */

/**
 * Keyword matching in Thai has a trap: the language has no word boundaries, so
 * a two-character keyword is a substring of ordinary words. "งบ" is inside
 * "ยังไงบ้าง" and "เจ" is inside "เจอ" — both would silently reroute a
 * question. Anything that short is written as a pattern that pins the context
 * it really appears in.
 */
type Matcher = string | RegExp;

const RULES: { intent: Intent; words: Matcher[] }[] = [
  { intent: 'greeting', words: ['สวัสดี', 'หวัดดี', 'ดีครับ', 'ดีค่ะ', 'hello', 'hi ', 'ทัก'] },
  { intent: 'thanks', words: ['ขอบคุณ', 'ขอบใจ', 'thank', 'ขอบคุน'] },
  { intent: 'order-status', words: ['ออเดอร์', 'คำสั่งซื้อ', 'สถานะ', 'ถึงไหน', 'อาหารถึงไหน', 'เมื่อไหร่จะได้', 'ติดตาม', 'order'] },
  { intent: 'payment', words: ['ชำระ', 'จ่ายเงิน', 'จ่าย', 'พร้อมเพย์', 'promptpay', 'สลิป', 'โอน', 'คิวอาร์', 'qr', 'เงินสด', 'บัตร'] },
  { intent: 'delivery', words: ['ส่ง', 'เดลิเวอรี', 'delivery', 'ค่าส่ง', 'ขั้นต่ำ', 'ส่งฟรี', 'รับที่ร้าน', 'กี่นาที', 'นานไหม'] },
  { intent: 'hours', words: ['กี่โมง', 'เวลาเปิด', 'เปิดกี่', 'ปิดกี่', 'เวลาทำการ', 'เปิดวัน', 'หยุดวัน', 'เปิดอยู่', 'open'] },
  { intent: 'location', words: ['ที่ตั้ง', 'อยู่ที่ไหน', 'อยู่ไหน', 'แผนที่', 'สาขา', 'ไปยังไง', 'ที่อยู่', 'พิกัด', 'map'] },
  { intent: 'contact', words: ['ติดต่อ', 'เบอร์โทร', 'โทร', 'ไลน์', /\bline\b/, 'เฟส', 'อีเมล', 'แชท'] },
  { intent: 'promotion', words: ['โปร', 'ส่วนลด', 'ลดราคา', 'คูปอง', 'โค้ด', 'ดีล', 'promotion'] },
  { intent: 'how-to-order', words: ['สั่งยังไง', 'สั่งอย่างไร', 'วิธีสั่ง', 'สั่งซื้อ', 'สมัคร', 'เข้าสู่ระบบ', 'ล็อกอิน', 'สมาชิก'] },
  { intent: 'human', words: ['คุยกับคน', 'พนักงาน', 'แอดมิน', 'เจ้าของ', 'คนจริง', 'staff'] },
  { intent: 'dietary', words: ['แพ้', 'มังสวิรัติ', /อาหารเจ|กินเจ|(^|[\s,])เจ([\s,]|$)/, 'vegan', 'vegetarian', 'สารก่อภูมิแพ้', 'ส่วนผสม', 'ส่วนประกอบ', 'แคลอรี'] },
  { intent: 'budget', words: [/งบ(ประมาณ)?\s*\d/, 'ไม่เกิน', 'ถูกที่สุด', 'ราคาถูก', 'ประหยัด'] },
  { intent: 'recommend', words: ['แนะนำ', 'อร่อย', 'กินอะไรดี', 'ทานอะไรดี', 'เด็ด', 'ซิกเนเจอร์', 'ยอดนิยม', 'ขายดี', 'อะไรดี'] },
];

/** Longer keywords are more specific, so they outweigh short generic ones. */
function weigh(matcher: Matcher, text: string) {
  if (typeof matcher === 'string') return text.includes(matcher) ? matcher.trim().length : 0;
  const hit = text.match(matcher);
  // A pattern earns at least as much as a mid-length keyword; what it matched
  // may be short, but it only matched because the context was right.
  return hit ? Math.max(hit[0].trim().length, 4) : 0;
}

function detectIntent(text: string): Intent {
  let best: { intent: Intent; score: number } | null = null;
  for (const rule of RULES) {
    const score = rule.words.reduce((total, word) => total + weigh(word, text), 0);
    if (score > 0 && (!best || score > best.score)) best = { intent: rule.intent, score };
  }
  return best?.intent ?? 'unknown';
}

/**
 * Does the sentence name something on the menu?
 *
 * Thai does not put spaces between words, so "ลาเต้ราคาเท่าไหร่" arrives as a
 * single token and splitting the question gets nowhere. The match runs the
 * other way instead: take the words of each dish's name and look for them
 * inside the sentence. The reverse direction still helps when someone types
 * only a fragment ("กะเพรา"), so both are tried.
 *
 * Only names are indexed, not ingredients. Indexing ingredients would make
 * "แพ้ไข่" match every dish containing egg and turn an allergy question into a
 * product description — the opposite of what was asked.
 */
function searchMenu(menu: MenuItem[], text: string) {
  if (text.length < 3) return [];
  return menu.filter((item) => {
    const name = item.name.toLocaleLowerCase('th');
    if (text.includes(name)) return true;
    const named = name
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .some((word) => text.includes(word));
    if (named) return true;
    const haystack = `${name} ${item.description} ${item.ingredients}`.toLocaleLowerCase('th');
    return haystack.includes(text);
  });
}

/* ------------------------------------------------------------------ *
 * Answers
 * ------------------------------------------------------------------ */

const DEFAULT_CHIPS = ['แนะนำเมนูหน่อย', 'ร้านเปิดกี่โมง', 'ค่าส่งเท่าไหร่', 'ออเดอร์ฉันถึงไหนแล้ว'];

function dishLine(item: MenuItem) {
  const allergens = item.allergens.length ? ` (มี${item.allergens.join(', ')})` : '';
  return `${item.emoji} ${item.name} ${baht(item.price)}${allergens}`;
}

/**
 * A meal that fits the money.
 *
 * Pairing a main with a drink is what someone asking "งบ 150" actually wants;
 * a list of three drinks they could afford separately is not an answer.
 */
function buildCombo(menu: MenuItem[], budget: number) {
  const mains = menu.filter((item) => item.category === 'food').sort((a, b) => b.price - a.price);
  const sides = menu.filter((item) => item.category !== 'food').sort((a, b) => b.price - a.price);

  for (const main of mains) {
    const side = sides.find((item) => main.price + item.price <= budget);
    if (side) return [main, side];
  }
  const single = menu.filter((item) => item.price <= budget).sort(byPreference).slice(0, 3);
  return single;
}

function orderAnswer(context: BrainContext, text: string): Answer {
  if (!context.signedIn) {
    return {
      intent: 'order-status',
      text: 'ต้องเข้าสู่ระบบก่อนนะคะ น้องอิ่มใจจะได้ดึงออเดอร์ของคุณมาให้ถูกคน หรือถ้าไม่อยากเข้าสู่ระบบ ใช้หน้า “ติดตามออเดอร์” พร้อมเลขออเดอร์กับเบอร์โทรก็ได้ค่ะ',
      chips: ['สั่งซื้อยังไง', 'ติดต่อร้าน'],
      link: { href: '/account', label: 'เข้าสู่ระบบ' },
    };
  }

  if (!context.orders.length) {
    return {
      intent: 'order-status',
      text: 'ยังไม่เห็นออเดอร์ในบัญชีนี้เลยค่ะ ถ้าเพิ่งสั่งจากอีกเครื่องหนึ่ง ลองค้นด้วยเลขออเดอร์ที่หน้าติดตามออเดอร์ได้นะคะ',
      chips: ['แนะนำเมนูหน่อย', 'ค่าส่งเท่าไหร่'],
      link: { href: '/track', label: 'ไปหน้าติดตามออเดอร์' },
    };
  }

  // If they quoted a reference, answer about that one — but only ever from
  // their own orders, so a guessed number cannot reveal somebody else's.
  const quoted = text.match(/ij\d{6}-[a-z0-9]{4}/i)?.[0]?.toLowerCase();
  const order =
    (quoted && context.orders.find((item) => item.orderNumber.toLowerCase() === quoted)) || context.orders[0];

  if (quoted && order.orderNumber.toLowerCase() !== quoted) {
    return {
      intent: 'order-status',
      text: `เลข ${quoted.toUpperCase()} ไม่ได้อยู่ในบัญชีนี้ค่ะ น้องอิ่มใจเปิดดูออเดอร์ของบัญชีอื่นไม่ได้ ลองตรวจที่หน้าติดตามออเดอร์พร้อมเบอร์โทรที่ใช้สั่งนะคะ`,
      link: { href: '/track', label: 'ไปหน้าติดตามออเดอร์' },
    };
  }

  const items = order.lines.map((line) => `${line.quantity} × ${line.name}`).join(', ');
  const eta = order.fulfilment === 'delivery' ? 'ประมาณ 30–45 นาที' : 'ประมาณ 20–30 นาที';
  const paymentLine =
    order.paymentStatus === 'paid'
      ? 'ยอดชำระตรวจกับธนาคารเรียบร้อยแล้ว'
      : `การชำระเงิน: ${PAYMENT_STATUS_LABEL[order.paymentStatus]}`;

  const text2 =
    order.status === 'cancelled'
      ? `ออเดอร์ ${order.orderNumber} ถูกยกเลิกแล้วค่ะ${order.paymentNote ? ` เหตุผล: ${order.paymentNote}` : ''} หากต้องการสอบถามเพิ่มเติม โทร ${SHOP_PHONE} ได้เลยค่ะ`
      : `ออเดอร์ ${order.orderNumber} ตอนนี้ “${ORDER_STATUS_LABEL[order.status]}” ค่ะ\nรายการ: ${items}\nยอดรวม ${baht(order.totals.total)} · ${order.fulfilment === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'} ${eta}\n${paymentLine}`;

  return {
    intent: 'order-status',
    text: text2,
    chips: ['สั่งเพิ่มได้ไหม', 'ติดต่อร้าน'],
    link: { href: `/track?order=${encodeURIComponent(order.orderNumber)}`, label: 'ดูไทม์ไลน์เต็ม' },
  };
}

function menuAnswer(intent: Intent, context: BrainContext, constraints: Constraints, matches: MenuItem[]): Answer {
  const pool = filterMenu(context.menu, constraints);

  // Something specific was named — answer about that dish.
  if (intent === 'menu-search' && matches.length) {
    const available = matches.filter((item) => item.available);
    if (!available.length) {
      const item = matches[0];
      const alternatives = context.menu
        .filter((other) => other.available && other.category === item.category)
        .sort(byPreference)
        .slice(0, 3);
      return {
        intent: 'menu-search',
        text: `${item.name} หมดแล้ววันนี้ค่ะ 😢 ขอแนะนำเมนูใกล้เคียงในหมวดเดียวกันแทนนะคะ`,
        dishes: alternatives,
        chips: ['แนะนำเมนูอื่น', 'ร้านเปิดกี่โมง'],
      };
    }
    const item = available[0];
    const detail = [
      `${item.name} ราคา ${baht(item.price)} ค่ะ`,
      item.description,
      `ส่วนประกอบ: ${item.ingredients}`,
      item.allergens.length ? `สารก่อภูมิแพ้: ${item.allergens.join(', ')}` : 'ไม่มีสารก่อภูมิแพ้หลักในรายการนี้',
      item.promotion ? `โปรโมชัน: ${item.promotion}` : '',
      item.stock <= 5 ? `เหลืออีก ${item.stock} ที่เท่านั้นนะคะ` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return {
      intent: 'menu-search',
      text: detail,
      dishes: available.slice(0, 3),
      chips: ['มีเมนูใกล้เคียงไหม', 'โปรโมชันวันนี้'],
    };
  }

  if (!pool.length) {
    const relaxed = constraints.budget
      ? `ตอนนี้ยังไม่มีเมนูที่ราคาไม่เกิน ${baht(constraints.budget)} ตามเงื่อนไขที่บอกมาค่ะ`
      : 'ยังไม่เจอเมนูที่ตรงเงื่อนไขทั้งหมดเลยค่ะ';
    const cheapest = [...context.menu].filter((item) => item.available).sort((a, b) => a.price - b.price)[0];
    return {
      intent,
      text: `${relaxed}${cheapest ? ` เมนูที่เบาที่สุดตอนนี้คือ ${dishLine(cheapest)} ค่ะ` : ''}`,
      dishes: cheapest ? [cheapest] : undefined,
      chips: ['แนะนำเมนูหน่อย', 'โปรโมชันวันนี้'],
    };
  }

  const conditions = [
    constraints.budget ? `งบ ${baht(constraints.budget)}` : '',
    constraints.avoid.length ? `เลี่ยง${constraints.avoid.join(', ')}` : '',
    constraints.mild ? 'ไม่เผ็ด' : '',
    constraints.category ? CATEGORIES.find((entry) => entry.id === constraints.category)?.label ?? '' : '',
  ].filter(Boolean);

  const preface = conditions.length ? `เลือกจากเงื่อนไข ${conditions.join(' · ')} ได้แบบนี้ค่ะ` : '';

  if (intent === 'budget' && constraints.budget) {
    const combo = buildCombo(pool, constraints.budget);
    const totalPrice = combo.reduce((sum, item) => sum + item.price, 0);
    return {
      intent: 'budget',
      text: combo.length > 1
        ? `${preface}\nจัดชุดนี้ให้ค่ะ ${combo.map((item) => item.name).join(' + ')} รวม ${baht(totalPrice)}`
        : `${preface}\n${combo.map(dishLine).join('\n')}`,
      dishes: combo,
      chips: [`ขั้นต่ำสั่งเท่าไหร่`, 'โปรโมชันวันนี้'],
    };
  }

  const picks = [...pool].sort(byPreference).slice(0, 3);
  return {
    intent: intent === 'dietary' ? 'dietary' : 'recommend',
    text:
      intent === 'dietary'
        ? `${preface || 'เลือกให้ตามที่แจ้งไว้ค่ะ'}\n${picks.map(dishLine).join('\n')}\n\nกรณีแพ้รุนแรง แนะนำให้โทรยืนยันกับร้านก่อนสั่งนะคะ เพราะครัวเดียวกันอาจมีการปนเปื้อนข้ามได้ค่ะ`
        : `${preface || 'เมนูที่คนสั่งบ่อยและครัวภูมิใจที่สุดค่ะ'}\n${picks.map(dishLine).join('\n')}`,
    dishes: picks,
    chips: ['ขอแบบไม่เผ็ด', 'ของหวานมีอะไรบ้าง', 'โปรโมชันวันนี้'],
  };
}

export function answer(question: string, context: BrainContext): Answer {
  const text = normalise(question);
  if (!text) {
    return { intent: 'unknown', text: 'พิมพ์คำถามหรือแตะหัวข้อด้านบนได้เลยค่ะ', chips: DEFAULT_CHIPS };
  }

  const constraints = readConstraints(question);
  const matches = searchMenu(context.menu, text);
  let intent = detectIntent(text);

  // A stated condition outranks the verb it was wrapped in. "แนะนำ" scores
  // higher than "แพ้" on keyword length alone, but someone who says they are
  // allergic is asking a different question from someone browsing.
  const menuFamily: Intent[] = ['recommend', 'menu-search', 'budget', 'dietary', 'unknown'];
  if (menuFamily.includes(intent)) {
    if (constraints.avoid.length) intent = 'dietary';
    else if (constraints.budget !== null) intent = 'budget';
    else if (intent === 'unknown' && matches.length) intent = 'menu-search';
  }

  switch (intent) {
    case 'greeting':
      return {
        intent,
        text: `สวัสดีค่ะ${context.customerName ? ` คุณ${context.customerName}` : ''} 🌿 น้องอิ่มใจช่วยเลือกเมนู เช็กเวลาเปิดร้าน ดูค่าส่ง และตามออเดอร์ให้ได้ค่ะ อยากเริ่มจากอะไรดีคะ`,
        chips: DEFAULT_CHIPS,
      };

    case 'thanks':
      return { intent, text: 'ยินดีค่ะ 💛 ถ้ามีอะไรให้ช่วยอีก ทักมาได้ตลอดเลยนะคะ', chips: DEFAULT_CHIPS };

    case 'hours':
      return {
        intent,
        text: `ร้านเปิด ${STORE_PROFILE.hours.everyday} ${STORE_PROFILE.hours.note} ครัวรับออเดอร์สุดท้าย ${STORE_PROFILE.hours.kitchenLastOrder} ค่ะ`,
        chips: ['ร้านอยู่ที่ไหน', 'สั่งเดลิเวอรีได้ไหม'],
      };

    case 'location':
      return {
        intent,
        text: `ร้านอยู่ที่ ${STORE_PROFILE.location.address} ค่ะ ${STORE_PROFILE.location.landmark}`,
        chips: ['ร้านเปิดกี่โมง', 'ติดต่อร้าน'],
        link: {
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_PROFILE.location.address)}`,
          label: 'เปิดแผนที่',
        },
      };

    case 'contact':
    case 'human':
      return {
        intent,
        text: `คุยกับพนักงานได้ที่ LINE ${SHOP_LINE} ตอบเร็วที่สุดค่ะ หรือโทร ${SHOP_PHONE} ในเวลาทำการ ${STORE_PROFILE.hours.everyday} ค่ะ`,
        chips: ['ร้านอยู่ที่ไหน', 'ร้านเปิดกี่โมง'],
        link: { href: '/contact', label: 'ไปหน้าติดต่อเรา' },
      };

    case 'delivery':
      return {
        intent,
        text: `สั่งได้ทั้งรับที่ร้านและจัดส่งค่ะ ไม่มียอดขั้นต่ำ สั่งกี่ชิ้นก็ได้\nค่าส่ง ${baht(STORE.deliveryFee)} และส่งฟรีเมื่อยอด ${baht(STORE.freeDeliveryAt)} ขึ้นไป\nรับที่ร้านประมาณ ${STORE_PROFILE.service.prepMinutes} จัดส่งประมาณ 30–45 นาทีค่ะ`,
        chips: ['สั่งซื้อยังไง', 'จ่ายเงินยังไงได้บ้าง'],
        link: { href: '/menu', label: 'เริ่มเลือกเมนู' },
      };

    case 'payment':
      return {
        intent,
        text: 'จ่ายได้ 2 แบบค่ะ\n1) เงินสดตอนรับอาหาร\n2) พร้อมเพย์ QR — ระบบจะสร้าง QR ตามยอดออเดอร์ของคุณโดยเฉพาะ สแกนจ่ายแล้วอัปโหลดสลิปในหน้าชำระเงิน\n\nน้องอิ่มใจไม่สามารถยืนยันการชำระเงินเองได้นะคะ ทุกสลิปจะถูกตรวจกับยอดจริงก่อน แล้วสถานะจะเปลี่ยนเป็น “ชำระเงินแล้ว” ให้อัตโนมัติค่ะ',
        chips: ['ค่าส่งเท่าไหร่', 'ออเดอร์ฉันถึงไหนแล้ว'],
      };

    case 'how-to-order':
      return {
        intent,
        text: 'ง่าย ๆ 4 ขั้นค่ะ\n1) เลือกเมนูและตัวเลือกที่ชอบ\n2) กดเพิ่มลงตะกร้า (ถ้ายังไม่ได้เข้าสู่ระบบ ระบบจะพาไปสมัคร/เข้าสู่ระบบก่อน แล้วพากลับมาที่เดิมให้)\n3) กรอกชื่อ เบอร์โทร และเลือกรับที่ร้านหรือจัดส่ง\n4) เลือกวิธีชำระเงินแล้วยืนยันออเดอร์ค่ะ',
        chips: ['ค่าส่งเท่าไหร่', 'จ่ายเงินยังไงได้บ้าง'],
        link: { href: '/menu', label: 'เริ่มเลือกเมนู' },
      };

    case 'promotion': {
      const promos = context.menu.filter((item) => item.available && item.promotion);
      if (!promos.length) {
        return {
          intent,
          text: 'ตอนนี้ยังไม่มีโปรโมชันที่กำลังใช้อยู่ค่ะ แต่คูปอง IMJAI15 ลด 15 บาทเมื่อยอดตั้งแต่ ฿200 ยังใช้ได้อยู่นะคะ',
          chips: ['แนะนำเมนูหน่อย'],
        };
      }
      return {
        intent,
        text: `โปรโมชันที่ใช้ได้ตอนนี้ค่ะ\n${promos.map((item) => `• ${item.name} — ${item.promotion}`).join('\n')}\n\nและคูปอง IMJAI15 ลด 15 บาท เมื่อยอดตั้งแต่ ${baht(200)} ขึ้นไปค่ะ`,
        dishes: promos.slice(0, 3),
        chips: ['สั่งซื้อยังไง', 'ค่าส่งเท่าไหร่'],
      };
    }

    case 'order-status':
      return orderAnswer(context, text);

    case 'recommend':
    case 'budget':
    case 'dietary':
    case 'menu-search':
      return menuAnswer(intent, context, constraints, matches);

    default:
      break;
  }

  // A category with no verb — "มีของหวานไหม" — is still a menu question.
  if (constraints.category) return menuAnswer('recommend', context, constraints, []);

  return {
    intent: 'unknown',
    text: `ขอโทษค่ะ น้องอิ่มใจยังตอบเรื่องนี้ไม่ได้ 🙏 เรื่องที่ช่วยได้คือ แนะนำเมนูตามงบและสิ่งที่แพ้ เวลาเปิดร้าน ที่ตั้ง ค่าส่ง วิธีชำระเงิน และสถานะออเดอร์ของคุณค่ะ\nถ้าอยากคุยกับพนักงานจริง ๆ ทัก LINE ${SHOP_LINE} หรือโทร ${SHOP_PHONE} ได้เลยค่ะ`,
    chips: DEFAULT_CHIPS,
  };
}

/** What the panel offers before anyone has typed anything. */
export const OPENING_CHIPS = ['แนะนำเมนูหน่อย', 'งบ 150 กินอะไรดี', 'ร้านเปิดกี่โมง', 'ค่าส่งเท่าไหร่'];

export function greeting(name?: string | null) {
  return `สวัสดีค่ะ${name ? ` คุณ${name}` : ''} น้องอิ่มใจอยู่นี่แล้ว 🌿 ถามเรื่องเมนู ราคา ของแพ้ ค่าส่ง หรือสถานะออเดอร์ได้เลยค่ะ`;
}
