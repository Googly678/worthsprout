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
    default: "WorthSprout — Independent, In-Depth Product Reviews",
    template: "%s | WorthSprout",
  },
  description:
    "Hands-on, lab-tested reviews and buying guides. We buy the products ourselves so our picks stay honest.",
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
