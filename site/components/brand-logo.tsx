/**
 * ImJai brand marks.
 *
 * Drawn as SVG so one definition serves the 28px header badge, the checkout
 * receipt and the 1200px social card without a second asset. Colour comes from
 * `currentColor`, letting the mark sit on cream, coffee or photography by
 * setting `color` on the parent.
 */

type MarkProps = {
  /** Rendered size in px; the artwork scales from a 96-unit square. */
  size?: number;
  className?: string;
  /** Accessible name; pass null for decorative use beside a text label. */
  title?: string | null;
};

/** The leaf sprig that sits above the badge, echoing the shopfront poster. */
function LeafSprig() {
  return (
    <g stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" fill="none">
      <path d="M70 22c6-7 13-9 19-8" />
      <path d="M78.5 17.5c1.5-4.5 5-7 9-7.5.5 4.5-1 8.5-4 10.5-2 1.4-4 1.2-5-3z" fill="currentColor" stroke="none" />
      <path d="M86 20c3.5-2.5 7.5-3 10.5-1.5-1.5 3.5-4.5 5.5-8 5.5-2 0-3-1.5-2.5-4z" fill="currentColor" stroke="none" />
    </g>
  );
}

/**
 * Circular badge: the Thai wordmark over its roman transliteration.
 * Used wherever the full lockup would be too wide — header, favicon, avatars.
 */
export function ImJaiMark({ size = 40, className, title = 'ImJai Cafe & Kitchen' }: MarkProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <circle cx="48" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth={2.4} />
      <LeafSprig />
      <text
        x="48"
        y="49"
        textAnchor="middle"
        fill="currentColor"
        fontFamily='"Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif'
        fontSize="26"
        fontWeight={700}
letterSpacing="-0.5"
      >
        อิ่มใจ
      </text>
      <line x1="30" y1="59" x2="66" y2="59" stroke="currentColor" strokeWidth={1.2} opacity={0.5} />
      <text
        x="48"
        y="72"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Georgia, serif"
        fontSize="11"
        fontWeight={600}
        letterSpacing="2.4"
      >
        IM JAI
      </text>
    </svg>
  );
}

type LockupProps = MarkProps & {
  /** Second line under the name. */
  tagline?: string;
};

/**
 * Horizontal lockup: badge plus name and tagline, for the footer, invoices and
 * anywhere the brand is introduced rather than merely referenced.
 */
export function ImJaiLockup({
  size = 44,
  className,
  tagline = 'CAFE & KITCHEN',
  title = 'ImJai Cafe & Kitchen',
}: LockupProps) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <ImJaiMark size={size} title={title} />
      <span style={{ display: 'grid', gap: 4, lineHeight: 1 }}>
        <b style={{ fontFamily: 'Georgia, serif', fontSize: size * 0.4, letterSpacing: '0.02em' }}>
          ImJai
        </b>
        <small style={{ fontSize: size * 0.17, letterSpacing: '0.26em', opacity: 0.7 }}>
          {tagline}
        </small>
      </span>
    </span>
  );
}
