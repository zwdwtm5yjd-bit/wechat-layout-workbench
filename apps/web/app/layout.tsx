import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "一键视觉",
  description: "面向定稿文章的云端智能视觉排版工作台",
  robots: {
    follow: false,
    index: false,
  },
  title: {
    default: "一键视觉",
    template: "%s · 一键视觉",
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
