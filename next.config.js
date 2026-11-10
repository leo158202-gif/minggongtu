/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript', 'xuantian-bazi'],
  serverExternalPackages: ['caelus', 'caelus-birth', 'luxon', 'tz-lookup'],
};

module.exports = nextConfig;
