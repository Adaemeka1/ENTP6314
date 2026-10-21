import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NemaGo",
  description: "A verified mobile mechanic, a locked price, at your car.",
};

export const viewport: Viewport = {
  themeColor: "#2a5bff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
