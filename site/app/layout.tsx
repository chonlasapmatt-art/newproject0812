import type { Metadata } from 'next';
import { SiteShell } from '../components/site-shell';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://imjai-cafe-kitchen-bangkok.edtech4.chatgpt.site'),
  title: 'ImJai Cafe & Kitchen — อิ่มใจ คาเฟ่ & ครัว',
  description: 'อาหาร กาแฟ และขนมอบสดใหม่ พร้อมรับที่ร้านหรือจัดส่งจาก ImJai Cafe & Kitchen',
  applicationName: 'ImJai Cafe & Kitchen',
  keywords: ['ร้านอาหาร', 'คาเฟ่', 'กาแฟ', 'อาหารเดลิเวอรี', 'ImJai', 'อิ่มใจ'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    siteName: 'ImJai Cafe & Kitchen',
    title: 'ImJai Cafe & Kitchen — มื้อธรรมดา ที่ทำให้ใจอิ่ม',
    description: 'อาหาร กาแฟ และขนมอบสดใหม่ พร้อมรับที่ร้านหรือจัดส่ง',
    url: 'https://imjai-cafe-kitchen-bangkok.edtech4.chatgpt.site',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ImJai Cafe & Kitchen — มื้อธรรมดา ที่ทำให้ใจอิ่ม' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ImJai Cafe & Kitchen — มื้อธรรมดา ที่ทำให้ใจอิ่ม',
    description: 'อาหาร กาแฟ และขนมอบสดใหม่ พร้อมรับที่ร้านหรือจัดส่ง',
    images: ['/og.png'],
  },
};

const restaurantJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: 'ImJai Cafe & Kitchen',
  alternateName: 'อิ่มใจ คาเฟ่ & ครัว',
  servesCuisine: ['Thai', 'Cafe', 'Bakery'],
  priceRange: '฿฿',
  url: 'https://imjai-cafe-kitchen-bangkok.edtech4.chatgpt.site',
  image: 'https://imjai-cafe-kitchen-bangkok.edtech4.chatgpt.site/og.png',
  telephone: '+66-2-123-4567',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '88/12 ถนนสุขุมวิท แขวงคลองตัน',
    addressLocality: 'เขตวัฒนา',
    addressRegion: 'กรุงเทพมหานคร',
    postalCode: '10110',
    addressCountry: 'TH',
  },
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], opens: '07:00', closes: '20:00' }],
  hasMenu: { '@type': 'Menu', name: 'เมนู ImJai Cafe & Kitchen' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className="no-js">
      <head>
        {/* Reveal-on-scroll ships with inline opacity:0 from the server. If the
            bundle never runs, this class stays and CSS restores visibility;
            when it does run, the class is gone before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.remove('no-js')",
          }}
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }} />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
