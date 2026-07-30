import type { NextConfig } from "next";

import { parsePublicEnvironment } from "@wechat-layout/config";

const publicConfiguration = parsePublicEnvironment({
  ...process.env,
  APP_ENV: process.env.APP_ENV ?? "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_NAME: publicConfiguration.appName,
    NEXT_PUBLIC_APP_URL: publicConfiguration.appUrl,
    NEXT_PUBLIC_API_BASE_URL: publicConfiguration.apiBaseUrl,
    NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED: String(publicConfiguration.features.wechatSync),
    NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED: String(
      publicConfiguration.features.remoteComponents,
    ),
  },
};

export default nextConfig;
