/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  typescript: { ignoreBuildErrors: false },
  // The Minds moderation call is slow (11-130s) — the rewrite proxy must not
  // kill it at the default 30s timeout or beat 6 dies on camera.
  experimental: { proxyTimeout: 200_000 },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/:path*` },
    ];
  },
};

export default nextConfig;
