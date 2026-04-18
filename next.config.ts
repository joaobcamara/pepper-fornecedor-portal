import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "anexos.tiny.com.br"
      },
      {
        protocol: "https",
        hostname: "s3.amazonaws.com",
        pathname: "/tiny-anexos-us/**"
      },
      {
        protocol: "https",
        hostname: "s3.amazonaws.com",
        pathname: "/erp/**"
      }
    ]
  }
};

export default nextConfig;
