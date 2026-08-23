export type MenuCategory = 'coffee' | 'non-coffee' | 'food' | 'dessert';

export type MenuItem = {
  sku: string;
  name: string;
  category: MenuCategory;
  price: number;
  description: string;
  ingredients: string;
  allergens: string[];
  available: boolean;
  stock: number;
  featured?: boolean;
  chefChoice?: boolean;
  promotion?: string;
  emoji: string;
  tone: string;
  options?: { label: string; values: string[] }[];
  addOns?: { name: string; price: number }[];
};

export const STORE = {
  name: 'ImJai Cafe & Kitchen',
  nameTh: 'อิ่มใจ คาเฟ่ & ครัว',
  tagline: 'มื้อธรรมดา ที่ทำให้ใจอิ่ม',
  address: '118 ซอยพหลโยธิน 69 เขตบางเขน กรุงเทพมหานคร',
  hours: 'ทุกวัน 07:00–20:00 น. (ครัวปิดรับออเดอร์ 19:30 น.)',
  phone: '099-875-6879',
  line: '@490ghfyn',
  deliveryFee: 30,
  freeDeliveryAt: 300,
  minimumOrder: 100,
};

const drinkOptions = [
  { label: 'อุณหภูมิ', values: ['เย็น', 'ร้อน'] },
  { label: 'ความหวาน', values: ['ปกติ', 'หวานน้อย', 'ไม่หวาน'] },
  { label: 'ขนาด', values: ['ปกติ', 'ใหญ่ +15'] },
];

export const CATEGORIES: { id: 'all' | MenuCategory; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'coffee', label: 'กาแฟ' },
  { id: 'non-coffee', label: 'เครื่องดื่ม' },
  { id: 'food', label: 'อาหาร' },
  { id: 'dessert', label: 'เบเกอรี่' },
];

export const MENU_ITEMS: MenuItem[] = [
  { sku: 'FD-01', name: 'ข้าวผัดกะเพราหมูสับ ไข่ดาว', category: 'food', price: 79, description: 'ผัดกะเพราหอม ๆ รสเผ็ดกลาง เสิร์ฟพร้อมไข่ดาว', ingredients: 'ข้าวหอมมะลิ หมูสับ ใบกะเพรา พริก กระเทียม ไข่ไก่', allergens: ['ไข่', 'ถั่วเหลือง'], available: true, stock: 18, featured: true, chefChoice: true, emoji: '🍳', tone: 'terra', options: [{ label: 'ระดับความเผ็ด', values: ['ไม่เผ็ด', 'เผ็ดน้อย', 'เผ็ดกลาง', 'เผ็ดมาก'] }], addOns: [{ name: 'ไข่ดาว', price: 15 }, { name: 'เพิ่มหมูสับ', price: 25 }] },
  { sku: 'FD-02', name: 'ข้าวไข่เจียวหมูสับ', category: 'food', price: 65, description: 'ไข่เจียวนุ่มสไตล์ญี่ปุ่น เสิร์ฟพร้อมข้าวสวยและน้ำจิ้มซีฟู้ด', ingredients: 'ข้าวหอมมะลิ ไข่ไก่ หมูสับ ต้นหอม', allergens: ['ไข่'], available: true, stock: 22, emoji: '🍚', tone: 'sand', addOns: [{ name: 'เพิ่มไข่', price: 12 }] },
  { sku: 'FD-03', name: 'สปาเก็ตตี้คาโบนาร่า', category: 'food', price: 99, description: 'ครีมชีสเบคอนและพาร์เมซาน หอมละมุน', ingredients: 'เส้นสปาเก็ตตี้ เบคอน ครีม พาร์เมซาน ไข่', allergens: ['นม', 'ไข่', 'กลูเตน'], available: true, stock: 12, featured: true, emoji: '🍝', tone: 'olive', addOns: [{ name: 'เพิ่มชีส', price: 20 }, { name: 'เพิ่มเบคอน', price: 25 }] },
  { sku: 'FD-04', name: 'แซนวิชแฮมชีส', category: 'food', price: 69, description: 'ขนมปังโฮลวีต แฮม เชดดาร์ชีส และผักสด', ingredients: 'ขนมปังโฮลวีต แฮม ชีส ผักกาด มะเขือเทศ', allergens: ['นม', 'กลูเตน'], available: true, stock: 14, emoji: '🥪', tone: 'mustard' },
  { sku: 'FD-05', name: 'ต้มยำกุ้ง', category: 'food', price: 120, description: 'ต้มยำน้ำข้นรสจัด ใส่กุ้งสด 4 ตัว', ingredients: 'กุ้ง ตะไคร้ ข่า ใบมะกรูด เห็ด นมข้นจืด', allergens: ['กุ้ง', 'นม'], available: false, stock: 0, emoji: '🍲', tone: 'terra' },
  { sku: 'DS-01', name: 'เค้กช็อกโกแลต', category: 'dessert', price: 89, description: 'เนื้อเข้มข้น หน้าเคลือบกานาชเนียน', ingredients: 'ช็อกโกแลต แป้ง ไข่ เนย ครีม', allergens: ['นม', 'ไข่', 'กลูเตน'], available: true, stock: 8, featured: true, emoji: '🍰', tone: 'cocoa' },
  { sku: 'DS-02', name: 'ครัวซองต์เนยสด', category: 'dessert', price: 55, description: 'อบสดทุกเช้า หอมเนย กรอบนอกนุ่มใน', ingredients: 'แป้งสาลี เนย นม ยีสต์', allergens: ['นม', 'กลูเตน'], available: true, stock: 10, chefChoice: true, promotion: 'ซื้อคู่กาแฟหรือชาลด 15 บาท', emoji: '🥐', tone: 'sage' },
  { sku: 'DS-03', name: 'ชีสเค้กเรดเวลเวท', category: 'dessert', price: 95, description: 'เนื้อนุ่มครีมชีส เปรี้ยวหวานกำลังดี', ingredients: 'ครีมชีส แป้ง ไข่ โกโก้', allergens: ['นม', 'ไข่', 'กลูเตน'], available: true, stock: 6, emoji: '🧁', tone: 'rose' },
  { sku: 'DR-C01', name: 'อเมริกาโน่', category: 'coffee', price: 60, description: 'เอสเพรสโซเข้ม หอมสะอาด เลือกร้อนหรือเย็น', ingredients: 'เมล็ดกาแฟอาราบิก้า น้ำ', allergens: [], available: true, stock: 40, emoji: '☕', tone: 'coffee', options: drinkOptions, addOns: [{ name: 'เพิ่มช็อต', price: 20 }] },
  { sku: 'DR-C02', name: 'ลาเต้', category: 'coffee', price: 70, description: 'เอสเพรสโซและนมสดเนียนนุ่ม', ingredients: 'เอสเพรสโซ นมสด', allergens: ['นม'], available: true, stock: 32, featured: true, chefChoice: true, promotion: 'ซื้อคู่เบเกอรี่ลด 15 บาท', emoji: '☕', tone: 'sand', options: drinkOptions, addOns: [{ name: 'เพิ่มช็อต', price: 20 }, { name: 'นมโอ๊ต', price: 20 }] },
  { sku: 'DR-C03', name: 'คาปูชิโน่', category: 'coffee', price: 70, description: 'เอสเพรสโซ นมสด และฟองนมนุ่ม', ingredients: 'เอสเพรสโซ นมสด', allergens: ['นม'], available: true, stock: 30, promotion: 'ซื้อคู่เบเกอรี่ลด 15 บาท', emoji: '☕', tone: 'coffee', options: drinkOptions, addOns: [{ name: 'เพิ่มช็อต', price: 20 }] },
  { sku: 'DR-C04', name: 'มอคค่าเย็น', category: 'coffee', price: 80, description: 'เอสเพรสโซ นม และช็อกโกแลตเข้มข้น', ingredients: 'เอสเพรสโซ นมสด ช็อกโกแลต', allergens: ['นม'], available: true, stock: 24, emoji: '🧋', tone: 'cocoa', options: drinkOptions, addOns: [{ name: 'เพิ่มช็อต', price: 20 }] },
  { sku: 'DR-N01', name: 'ชาไทยเย็น', category: 'non-coffee', price: 65, description: 'ชาไทยหอมเข้ม นมข้นและนมสด', ingredients: 'ชาไทย นมข้น นมสด', allergens: ['นม'], available: true, stock: 30, emoji: '🧋', tone: 'terra', options: drinkOptions },
  { sku: 'DR-N02', name: 'มัทฉะลาเต้', category: 'non-coffee', price: 85, description: 'มัทฉะเกรดพรีเมียมตีสดกับนม', ingredients: 'มัทฉะ นมสด', allergens: ['นม'], available: true, stock: 18, featured: true, emoji: '🍵', tone: 'sage', options: drinkOptions, addOns: [{ name: 'นมโอ๊ต', price: 20 }] },
  { sku: 'DR-N03', name: 'น้ำผึ้งมะนาวโซดา', category: 'non-coffee', price: 60, description: 'สดชื่นจากน้ำผึ้ง มะนาว และโซดา', ingredients: 'น้ำผึ้ง มะนาว โซดา', allergens: [], available: true, stock: 28, emoji: '🍋', tone: 'mustard', options: [{ label: 'ความหวาน', values: ['ปกติ', 'หวานน้อย', 'ไม่หวาน'] }] },
  { sku: 'DR-N04', name: 'สมูทตี้สตรอว์เบอร์รี', category: 'non-coffee', price: 90, description: 'สตรอว์เบอร์รีปั่นกับโยเกิร์ต สดชื่นพอดี', ingredients: 'สตรอว์เบอร์รี โยเกิร์ต นม', allergens: ['นม'], available: true, stock: 16, emoji: '🍓', tone: 'rose', options: [{ label: 'ความหวาน', values: ['ปกติ', 'หวานน้อย', 'ไม่หวาน'] }] },
];

export const findMenuItem = (sku: string) => MENU_ITEMS.find((item) => item.sku === sku);
