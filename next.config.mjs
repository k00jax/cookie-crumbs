/** @type {import('next').NextConfig} */
const nextConfig = {
  // Client-only data app (all APIs CORS-open) → static export is the intended deploy artifact
  // (Cloudflare Pages / GH Pages). Also avoids the server page-data pass entirely.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
