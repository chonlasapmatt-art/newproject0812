/**
 * Everything the site says about the shop itself, in one place.
 *
 * The contact and about pages, the footer, the structured data and the chat
 * assistant all read from here, so correcting a phone number is one edit
 * rather than a search across the codebase.
 *
 * PLACEHOLDER marks a value invented for the build. Each one is wrong on
 * purpose — a number that looks plausible but rings nobody is worse than one
 * that is obviously a stand-in, and `pendingRealData` below lists them so
 * nothing quietly ships as fact.
 */

export type ContactChannel = {
  id: string;
  label: string;
  value: string;
  /** Where tapping it goes. Empty for things that are read, not opened. */
  href?: string;
  hint?: string;
  /** True while the value is still a stand-in. */
  placeholder?: boolean;
};

export const STORE_PROFILE = {
  name: 'ImJai Cafe & Kitchen',
  nameTh: 'อิ่มใจ คาเฟ่ & ครัว',
  tagline: 'มื้อธรรมดา ที่ทำให้ใจอิ่ม',

  owner: {
    name: 'ชลทรัพย์ มัททวีวงศ์',
    role: 'เจ้าของร้าน',
    /** PLACEHOLDER — replace with what the owner wants customers to read. */
    note: 'ทำครัวเองทุกจาน ตั้งแต่วันแรกจนวันนี้',
    placeholderNote: true,
  },

  story: {
    since: 2569,
    /** PLACEHOLDER — the real story should come from the owner. */
    body: [
      'อิ่มใจเริ่มจากครัวเล็ก ๆ ที่อยากให้คนกินรู้สึกเหมือนได้กลับบ้าน',
      'เราเลือกวัตถุดิบเอง ปรุงสดใหม่ทุกจาน และเสิร์ฟในแบบที่อยากทำให้คนที่เรารักทาน',
    ],
    placeholder: true,
  },

  location: {
    /** PLACEHOLDER — needs the real shopfront address. */
    address: '88/12 ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพมหานคร 10110',
    landmark: 'ใกล้ทางออก MRT ที่ใกล้ที่สุด',
    placeholder: true,
  },

  hours: {
    everyday: '07:00 – 20:00 น.',
    kitchenLastOrder: '19:30 น.',
    note: 'เปิดทุกวัน ไม่มีวันหยุด',
    placeholder: true,
  },

  service: {
    deliveryFee: 30,
    freeDeliveryAt: 300,
    minimumOrder: 100,
    prepMinutes: '20–30 นาที',
  },
} as const;

/**
 * How a customer reaches a person.
 *
 * LINE is first because it is where the shop actually answers; the rest are
 * fallbacks for people who do not use it.
 */
export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    id: 'line',
    label: 'LINE Official Account',
    // The placeholder. The contact page swaps in whatever the shop saved in
    // the dashboard, so this is only what a brand-new install shows.
    value: '@imjaicafe',
    href: 'https://line.me/R/ti/p/%40imjaicafe',
    hint: 'ตอบเร็วที่สุด ทักได้ตลอดเวลาทำการ',
    placeholder: true,
  },
  {
    id: 'phone',
    label: 'โทรหาร้าน',
    value: '02-123-4567',
    href: 'tel:021234567',
    hint: 'สั่งด่วนหรือสอบถามเรื่องออเดอร์',
    placeholder: true,
  },
  {
    id: 'address',
    label: 'แวะมาที่ร้าน',
    value: STORE_PROFILE.location.address,
    hint: STORE_PROFILE.hours.note,
    placeholder: true,
  },
];

/**
 * Demo reviews.
 *
 * They exist so the section has its shape while the shop is being built — the
 * layout, the star row, the card sizing all need something in them to be worth
 * looking at. Nobody said these words. They are marked here, labelled on the
 * page and listed below, because a testimonial nobody gave is the one kind of
 * placeholder a visitor cannot tell apart from the real thing.
 */
export const DEMO_REVIEWS = [
  { quote: 'กาแฟหอม อาหารทำสดจริง บรรยากาศอบอุ่นเหมือนมานั่งบ้านเพื่อนค่ะ', name: 'มิน', context: 'ลูกค้าประจำ' },
  { quote: 'กะเพรารสกำลังดี ไข่ดาวขอบกรอบ แล้วระบบสั่งใช้ง่ายมาก', name: 'ต้น', context: 'สั่งเดลิเวอรี' },
  { quote: 'ครัวซองต์อบใหม่คู่ลาเต้คือพอดีมาก พนักงานน่ารักทุกคน', name: 'แพรว', context: 'แวะช่วงเช้า' },
] as const;

/** Listed so the shop can see at a glance what still needs real values. */
export const pendingRealData = [
  'ที่อยู่ร้านจริง',
  'เบอร์โทรร้าน',
  'LINE Official Account ID จริง',
  'เวลาเปิด–ปิดจริง',
  'เรื่องราวร้านในแบบที่เจ้าของอยากเล่า',
  'รีวิวลูกค้าจริง (ตอนนี้เป็นตัวอย่างสำหรับดูหน้าตา)',
] as const;

/**
 * Shortcuts for the two channels code quotes inline — a rejected slip telling
 * the customer who to call, the assistant handing out the LINE id. Reading
 * them from the same list the contact page renders means one edit fixes every
 * mention.
 */
const channel = (id: string) => CONTACT_CHANNELS.find((entry) => entry.id === id)?.value ?? '';
export const SHOP_PHONE = channel('phone');
export const SHOP_LINE = channel('line');
export const SHOP_LINE_URL = CONTACT_CHANNELS.find((entry) => entry.id === 'line')?.href ?? '';
