import type { NextConfig } from "next";
import dns from "dns";

// Ensure Node defaults to IPv4 first to prevent 10s connection hangs on dual-stack networks
if (typeof dns?.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
};

export default nextConfig;