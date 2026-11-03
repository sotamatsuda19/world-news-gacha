import type { NextConfig } from "next";
import { networkInterfaces } from "os";

// The dev server only serves its JavaScript to pages opened via localhost.
// Allow this Mac's own LAN addresses too, so a phone on the same Wi-Fi can open
// http://<this Mac's IP>:3000. Read at startup, so a new IP just needs a restart.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: lanAddresses,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
