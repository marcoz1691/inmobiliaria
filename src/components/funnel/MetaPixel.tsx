"use client";

import Script from "next/script";

type Fbq = (cmd: "init" | "track", ...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/**
 * Meta Pixel, rendered only when the tenant configured META_PIXEL_ID (the page passes no id
 * otherwise, so nothing loads). Fires PageView; Lead/Schedule go through `trackPixel`.
 */
export function MetaPixel({ pixelId }: { pixelId: string }) {
  if (!/^\d{5,20}$/.test(pixelId)) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
    </Script>
  );
}

/** Browser-side event, deduplicated with the Conversions API through the shared `eventID`. */
export function trackPixel(event: "Lead" | "Schedule", eventId: string) {
  window.fbq?.("track", event, {}, { eventID: eventId });
}
