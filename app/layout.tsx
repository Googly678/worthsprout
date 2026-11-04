import type { Metadata } from "next";
import type { ReactNode } from "react";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://worthsprout.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WorthSprout — Research-Based Product Reviews",
    template: "%s | WorthSprout",
  },
  description:
    "Research-based product reviews and buying guides. We compare specs, prices, and owner feedback to help you choose.",
  openGraph: {
    type: "website",
    siteName: "WorthSprout",
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="flex min-h-screen flex-col bg-white font-sans text-base text-gray-900 antialiased">
        {/* Impact.com 站点验证：官方片段用 value，实际校验器也会读 content，两个都输出以兼容 */}
        <meta
          name="impact-site-verification"
          {...{ value: "9e04e47e-81bb-4fc9-b06f-fb695f795284", content: "9e04e47e-81bb-4fc9-b06f-fb695f795284" }}
        />
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
