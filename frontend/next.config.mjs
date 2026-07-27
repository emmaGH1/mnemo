/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  typescript: { ignoreBuildErrors: false },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/:path*` },
    ];
  },
};

export default nextConfig;
