import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solarys Fraud Detection Demo",
  description: "MCP-compliant AI fraud detection system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
