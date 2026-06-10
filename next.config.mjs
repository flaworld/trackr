/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@prisma/client",
    "bcryptjs",
    "imapflow",
    "mailparser",
  ],
};

export default nextConfig;
