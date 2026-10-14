import type { NextConfig } from "next";

/**
 * next-intl's plugin only aliases `next-intl/config` to our request config. We set the alias
 * directly: the plugin pulls in @swc/core, whose native-binding cache check fails on drives that
 * grant other users write access (e.g. D:\ on Windows).
 */
const I18N_REQUEST = "./src/i18n/request.ts";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: { "next-intl/config": I18N_REQUEST },
  },
  webpack(config) {
    config.resolve.alias["next-intl/config"] = new URL(I18N_REQUEST, import.meta.url).pathname;
    return config;
  },
};

export default nextConfig;
