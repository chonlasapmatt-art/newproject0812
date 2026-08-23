'use client';

import Image from 'next/image';

/**
 * A dish's photo, once the shop has one.
 *
 * A thin `next/image` wrapper rather than a smart fallback component: the
 * three places a dish's art appears (the home grid, the menu grid, the dish
 * sheet) already know how to render the emoji tile they ship with today, so
 * the only new decision — photo or emoji — is made once at each call site
 * (`item.image ? <DishArt .../> : <span>{item.emoji}</span>`).
 *
 * `unoptimized` is required for the GitHub Pages static export (see
 * `next.config.ts`) and is the safer default for the Vinext/Cloudflare build
 * too, which has no image-optimization server to hand `next/image` off to.
 */

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
};

export function DishArt({ src, alt, sizes, className }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      loading="lazy"
      className={className}
      style={{ objectFit: 'cover' }}
    />
  );
}
