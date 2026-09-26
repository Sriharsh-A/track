import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRACK — My Plans",
  description: "Build a plan, keep track of your daily habits, and show up consistently.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
