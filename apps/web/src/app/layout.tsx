import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://labs.solarys.ai/mcpa2a"),
  title: "Solarys Fraud Detection Demo",
  description: "MCP-compliant AI fraud detection system with multi-agent orchestration for real-time transaction analysis",
  icons: { icon: "/mcpa2a/solaryslogo.svg", apple: "/mcpa2a/solaryslogo.svg" },
  openGraph: {
    title: "Solarys Fraud Detection Demo",
    description: "MCP-compliant AI fraud detection system with multi-agent orchestration for real-time transaction analysis",
    url: "https://labs.solarys.ai/mcpa2a",
    type: "website",
    siteName: "Solarys",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Solarys - AI Fraud Detection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Solarys Fraud Detection Demo",
    description: "MCP-compliant AI fraud detection system with multi-agent orchestration for real-time transaction analysis",
    images: ["/opengraph-image.png"],
  },
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
