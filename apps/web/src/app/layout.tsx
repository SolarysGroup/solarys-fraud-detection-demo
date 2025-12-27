import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solarys Fraud Detection Demo",
  description: "MCP-compliant AI fraud detection system",
  icons: { icon: "/solaryslogo.svg", apple: "/solaryslogo.svg" },
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
