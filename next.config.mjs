/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Prevent bundling ssh2; keep it as a Node.js external for server routes
  serverExternalPackages: ['ssh2'],
};

export default nextConfig;
