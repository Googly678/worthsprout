import type { Metadata } from "next";
import NotificationsView from "@/components/NotificationsView";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Replies to your comments and moderation updates on WorthSprout.",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return <NotificationsView />;
}
