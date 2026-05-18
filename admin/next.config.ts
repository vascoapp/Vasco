import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async redirects() {
    return [
      { source: "/privacy", destination: "/legal/privacy-policy", permanent: true },
      { source: "/terms", destination: "/legal/terms-of-service", permanent: true },
      { source: "/eula", destination: "/legal/eula", permanent: true },
      { source: "/cookies", destination: "/legal/cookie-policy", permanent: true },
      { source: "/dpa", destination: "/legal/data-processing-agreement", permanent: true },
      { source: "/aup", destination: "/legal/acceptable-use-policy", permanent: true },
    ];
  },
};

export default nextConfig;
