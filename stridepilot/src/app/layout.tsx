import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { APP_NAME } from "@/lib/app-config";
import { getSiteCopy } from "@/lib/site-copy";
import { getConfiguredSiteLocale } from "@/lib/site-variant";
import { AnalyticsBootstrap } from "./analytics-bootstrap";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const locale = getConfiguredSiteLocale(host);
  const copy = getSiteCopy(locale);
  return {
    title: APP_NAME,
    description: copy.appDescription,
    applicationName: APP_NAME,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: APP_NAME,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0f14",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host");
  const locale = getConfiguredSiteLocale(host);
  return (
    <html lang={locale} data-theme="dark" data-site-locale={locale}>
      <body>
        {children}
        <AnalyticsBootstrap />
      </body>
    </html>
  );
}
