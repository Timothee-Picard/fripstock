import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Rassemble le serveur et ses seules dépendances utiles dans
  // `.next/standalone`, que l'image de production copie telle quelle. Sans
  // cette option, il faudrait embarquer tout node_modules pour `next start`.
  output: 'standalone',
};

export default nextConfig;
