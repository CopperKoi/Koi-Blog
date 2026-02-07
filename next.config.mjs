import crypto from "node:crypto";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async generateBuildId() {
    const t = process.env.SOURCE_DATE_EPOCH || String(Date.now());
    const secret = process.env.BUILD_ID_SECRET || "change-me";
    const tag = crypto
      .createHmac("sha256", secret)
      .update(t)
      .digest("base64url")
      .slice(0, 12);
    return `copperkoi-${tag}`;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons**"
      }
    ]
  }
};

export default nextConfig;
