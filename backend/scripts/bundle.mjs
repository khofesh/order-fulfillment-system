// bundles every Lambda handler in src/handlers into dist/<name>/index.js
// Terraform (infra/lambda.tf) zips each directory into a deployment package.
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";

const handlersDir = new URL("../src/handlers/", import.meta.url).pathname;
const outDir = new URL("../dist/", import.meta.url).pathname;

const entries = readdirSync(handlersDir).filter((f) => f.endsWith(".ts"));

await Promise.all(
  entries.map((file) =>
    build({
      entryPoints: [join(handlersDir, file)],
      outfile: join(outDir, basename(file, ".ts"), "index.js"),
      bundle: true,
      platform: "node",
      target: "node22",
      format: "cjs",
      sourcemap: "inline",
      external: ["@aws-sdk/*"],
      logLevel: "warning",
    }),
  ),
);

console.log(`Bundled ${entries.length} handlers into dist/`);
