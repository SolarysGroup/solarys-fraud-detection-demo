import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://solarys.ai"),
  title: "Solarys Fraud Detection Demo",
  description: "MCP-compliant AI fraud detection system with multi-agent orchestration for real-time transaction analysis",
  icons: { icon: "/solaryslogo.svg", apple: "/solaryslogo.svg" },
  openGraph: {
    title: "Solarys Fraud Detection Demo",
    description: "MCP-compliant AI fraud detection system with multi-agent orchestration for real-time transaction analysis",
    url: "https://solarys.ai",
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
