import { existsSync, readFileSync } from "node:fs";
import { Agent } from "node:https";
import { homedir } from "node:os";
import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import vueDevTools from "vite-plugin-vue-devtools";

function emulatorProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const apiId = env.EMULATOR_API_ID;
  if (!apiId) return {};

  const port = env.EMULATOR_PORT || "9297";
  const region = env.EMULATOR_REGION || "us-east-1";
  const stage = env.EMULATOR_STAGE || "local";
  // New CA every emulator start; read it from its path, never disable TLS checks.
  const caPath = `${homedir()}/.aws/emulator/${port}/ca.pem`;
  if (!existsSync(caPath)) throw new Error(`Emulator CA not found at ${caPath}; is it running?`);

  return {
    "/api": {
      target: `https://127.0.0.1:${port}`,
      // Verify against the emulator's cert (issued for localhost), not the
      // execute-api Host header we route by.
      agent: new Agent({ ca: readFileSync(caPath), servername: "localhost" }),
      headers: { host: `${apiId}.execute-api.${region}.amazonaws.com` },
      rewrite: (path) => path.replace(/^\/api/, `/${stage}`),
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: emulatorProxy(env),
    },
  };
});
