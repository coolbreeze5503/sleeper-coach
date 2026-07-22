import { Teko, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const teko = Teko({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Gameplan — Weekly Roster Coach",
  description: "Week-by-week roster optimization for your Sleeper fantasy football team.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${teko.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
