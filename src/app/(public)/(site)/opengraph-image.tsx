import { ImageResponse } from "next/og";
import { agentTagline, getSite } from "../_lib/site";

export const alt = "Asesoría inmobiliaria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default share card: the agent's name and descriptor on the site's paper/ink palette. */
export default async function OpenGraphImage() {
  const site = await getSite();
  const tagline = agentTagline(site.agent);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f5f0",
          color: "#15171a",
          padding: "72px 80px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", width: 96, height: 4, background: "#9a4527" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, lineHeight: 1.05, letterSpacing: -2 }}>{site.name}</div>
          {tagline ? <div style={{ marginTop: 24, fontSize: 36, color: "#585c63", fontFamily: "sans-serif" }}>{tagline}</div> : null}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#585c63", fontFamily: "sans-serif" }}>Propiedades · Agenda una cita</div>
      </div>
    ),
    size,
  );
}
