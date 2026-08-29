import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./v2.css";
import "./v3.css";
import "./v4.css";
import "./v5.css";
import "./v6.css";
import "./v7.css";
import "./v8.css";
import "./v10.css";
import "./v11.css";
import "./v12.css";
import "./v13.css";
import "./v14.css";
import "./v15.css";
import "./v16.css";
import "./v17.css";
import "./v18.css";
import "./v19.css";
import "./v20.css";
import "./v20-fixes.css";
import "./v21.css";
import "./v22.css";
import "./v24.css";
import "./v25.css";
import "./v26.css";
import "./v28.css";
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
export const metadata: Metadata = {
  title: "Better Cricut Editor",
  description:
    "A private A4 design workspace for Cricut-ready SVG, PNG and PDF exports.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
