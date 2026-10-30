import type { Metadata } from "next";
import AccountView from "@/components/AccountView";

export const metadata: Metadata = {
  title: "My profile",
  description: "Manage your WorthSprout account details, password, and preferences.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountView />;
}
