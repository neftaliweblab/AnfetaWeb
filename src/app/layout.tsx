import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANFETA - Productividad Ejecutiva",
  description: "Asistente de productividad ejecutiva para Windows 10 y 11",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png?v=2", type: "image/png", sizes: "256x256" },
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/anfeta-logo.png?v=2", type: "image/png", sizes: "256x256" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: "/icon.png?v=2",
  },
};

export const viewport: Viewport = {
  themeColor: "#00A8FF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full bg-[#080B0F] antialiased">
      <head>
        <link rel="icon" href="/icon.png?v=2" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico?v=2" />
        <link rel="apple-touch-icon" href="/icon.png?v=2" />
      </head>
      <body className="h-full w-full overflow-hidden bg-[#080B0F] text-[#F1F5F9]">
        {children}
      </body>
    </html>
  );
}
