/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  typescript: { ignoreBuildErrors: false },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:3000/:path*" },
    ];
  },
};

export default nextConfig;
