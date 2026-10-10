// MAETRY: build target for Cloudflare Workers (see MAETRY.md).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

export default {
  ...config,
  // Next's tracer requires @opentelemetry/api inside try/catch and falls back to its
  // compiled copy; under pnpm the package is not resolvable from the middleware bundle.
  edgeExternals: [...(config.edgeExternals ?? []), "@opentelemetry/api"],
};
