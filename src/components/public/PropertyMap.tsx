"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

export type MapPoint = { lat: number; lng: number; radiusMeters: number | null };

// Leaflet touches `window`, so it only ever loads in the browser, in its own chunk.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-shimmer bg-sand" aria-hidden="true" />,
});

/**
 * Location map that never competes with the LCP: the Leaflet chunk and OSM tiles load only
 * when the map scrolls near the viewport. `radiusMeters` draws an approximate area, null a pin.
 */
export function PropertyMap({ point, label }: { point: MapPoint; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} role="region" aria-label={label} className="relative isolate aspect-[4/3] overflow-hidden rounded-sm bg-sand sm:aspect-[16/9]">
      {visible ? <LeafletMap point={point} /> : null}
    </div>
  );
}
