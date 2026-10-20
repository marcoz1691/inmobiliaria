"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer } from "react-leaflet";
import type { MapPoint } from "./PropertyMap";

// Inline SVG pin: avoids Leaflet's default marker images, which break under bundlers.
const pin = L.divIcon({
  className: "",
  html: '<svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23Z" fill="#1b2a41" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>',
  iconSize: [32, 40],
  iconAnchor: [16, 39],
});

export default function LeafletMap({ point }: { point: MapPoint }) {
  const center: [number, number] = [point.lat, point.lng];
  const approximate = point.radiusMeters !== null;
  return (
    <MapContainer
      center={center}
      zoom={approximate ? 14 : 16}
      scrollWheelZoom={false}
      className="absolute inset-0 h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {approximate ? (
        <Circle center={center} radius={point.radiusMeters!} pathOptions={{ color: "#1b2a41", weight: 1.5, fillColor: "#1b2a41", fillOpacity: 0.12 }} />
      ) : (
        <Marker position={center} icon={pin} keyboard={false} />
      )}
    </MapContainer>
  );
}
