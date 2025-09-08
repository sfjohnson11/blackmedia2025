/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  basePath: "",
  output: "standalone",

  async headers() {
    return [
      {
        source: "/(.*).mp4",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/freedom_school", destination: "/freedom-school", permanent: true },
      { source: "/freedomschool", destination: "/freedom-school", permanent: true },
    ];
  },
};

module.exports = nextConfig;
