import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["jsqr"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.qrserver.com", pathname: "/v1/create-qr-code/**" },
      { protocol: "https", hostname: "dandi-lost-items.s3.ap-northeast-2.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "http", hostname: "localhost", port: "8080", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8080", pathname: "/**" },
    ],
  },
};

export default nextConfig;
