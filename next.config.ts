import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs'],
  // Webpack alias (used in production builds on Vercel)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        exceljs: path.resolve(__dirname, 'node_modules/exceljs/dist/exceljs.min.js'),
      };
    }
    return config;
  },
  // Turbopack alias (used in local dev)
  turbopack: {
    resolveAlias: {
      exceljs: './node_modules/exceljs/dist/exceljs.min.js',
    },
  },
};

export default nextConfig;
