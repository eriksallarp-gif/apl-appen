/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  reactStrictMode: true,
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/faq',
        destination: '/ny-hemsida-faq',
        permanent: true,
      },
      {
        source: '/funktioner',
        destination: '/ny-hemsida-funktioner',
        permanent: true,
      },
      {
        source: '/kontakt',
        destination: '/ny-hemsida-kontakt',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
