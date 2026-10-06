import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteAccessGate from "@/components/site-access-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Palawan Collective OS — Your links, in one place",
  description: "A shared developer directory for Palawan Collective project environments, repositories, deployments, and handoff notes.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SiteAccessGate>{children}</SiteAccessGate>
      </body>
    </html>
  );
}
