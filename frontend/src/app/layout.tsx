import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Strata | The AI-Native Data Science Studio & Version Control",
    template: "%s | Strata",
  },
  description:
    "Preview any tabular data instantly, execute zero-cloud-wait DuckDB SQL queries, and track dataset versions with Git-grade cryptographic diffs.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Strata | The AI-Native Data Science Studio",
    description:
      "AI-native data science platform with sub-second DuckDB analytics, immutable version DAGs, and autonomous dataset intelligence.",
    url: "https://strata.ai",
    siteName: "Strata",
    images: [
      {
        url: "/strata-brand.jpg",
        width: 1024,
        height: 1024,
        alt: "Strata AI Data Science Studio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Strata | The AI-Native Data Science Studio",
    description:
      "AI-native data science platform with sub-second DuckDB analytics, immutable version DAGs, and autonomous dataset intelligence.",
    images: ["/strata-brand.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
