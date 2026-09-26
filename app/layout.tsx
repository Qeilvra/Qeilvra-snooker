import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Qeilvra", template: "%s | Qeilvra" },
  description: "Snooker club point of sale and management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061014",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
