'use client';

import { MapPin } from 'lucide-react';
import { STORE_PROFILE } from '../lib/store-profile';
import { useStoreSettings } from '../lib/store-settings';

/**
 * A real map of where the shop is.
 *
 * This was a drawing — three stripes for roads and a pin in the middle — which
 * told a customer nothing about how to get here. Google renders the actual
 * streets from the address, so correcting the address corrects the map, and
 * there is no second place to keep in step.
 *
 * Embedded rather than linked because someone deciding whether to walk over
 * should not have to leave the page to find out how far it is; the link out is
 * still there for the ones who want directions.
 *
 * No API key, deliberately. The keyed Maps Embed API would put a billable
 * credential in a page anyone can view source on, for a map that never needs
 * to do more than show one address.
 */

export function StoreMap({ className = '' }: { className?: string }) {
  // The saved address wins, so a correction from the dashboard moves the map.
  const settings = useStoreSettings();
  const address = settings.address || STORE_PROFILE.location.address;
  const query = encodeURIComponent(address);

  return (
    <div className={`store-map ${className}`.trim()}>
      <iframe
        title={`แผนที่ร้าน ${STORE_PROFILE.nameTh}`}
        src={`https://maps.google.com/maps?q=${query}&z=16&hl=th&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <a
        className="store-map-open"
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noreferrer"
      >
        <MapPin size={15} /> เปิดใน Google Maps
      </a>
    </div>
  );
}
