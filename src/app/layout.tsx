import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { env } from "@/env";
import "./globals.css";

// Apple devices render San Francisco (system font); Inter is the open fallback elsewhere.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  // Fallback for absolute URLs; public pages override it with the request's own host.
  metadataBase: new URL(env.APP_URL),
  title: "Asesoría inmobiliaria",
  description: "Propiedades seleccionadas y acompañamiento personal en Ecuador.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
