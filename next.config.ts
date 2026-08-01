import type { NextConfig } from "next";

import { embedParents } from "./lib/embed";

// Without this the allowlist would only gate the theme messages and any site
// could still frame the map — the origins are what makes the embed a guest
// rather than a free-for-all. Unset means nobody but the app itself.
const frameAncestors = ["'self'", ...embedParents()].join(" ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
