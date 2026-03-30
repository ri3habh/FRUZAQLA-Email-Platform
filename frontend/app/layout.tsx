import type { Metadata } from "next";
import { Rubik, Roboto_Condensed } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-rubik",
  display: "swap",
});

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-roboto-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solstice — Pharma Content Studio",
  description: "FDA-compliant marketing content, built with guardrails.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rubik.variable} ${robotoCondensed.variable}`}>
      <body className="bg-gray-50 text-gray-900 antialiased" style={{ fontFamily: "var(--font-rubik), sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
