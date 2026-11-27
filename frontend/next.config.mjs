/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://bizflow360-p3sp.onrender.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
