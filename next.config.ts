import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ma natywne bindingi (.node) — nie bundluj webpackiem, require at runtime
  serverExternalPackages: ['sharp', 'playwright', '@sparticuz/chromium'],
};

export default nextConfig;
