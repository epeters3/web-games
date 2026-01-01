import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Games",
  description: "Experiments and prototypes for web-based games."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
