import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/app-router-entry',
  compatibility_flags: ['nodejs_compat'],
};

export default defineConfig(async ({ mode }) => {
  const publicEnv = loadEnv(mode, process.cwd(), 'NEXT_PUBLIC_');
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    define: {
      'process.env.NEXT_PUBLIC_PROJECT_FILE_STORAGE': JSON.stringify(process.env.NEXT_PUBLIC_PROJECT_FILE_STORAGE ?? publicEnv.NEXT_PUBLIC_PROJECT_FILE_STORAGE ?? 'true'),
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      // Paper is used only inside browser edit actions. Strip its optional
      // Node canvas adapters so SSR does not resolve jsdom/canvas dependencies.
      {
        name: 'paper-browser-only',
        enforce: 'pre' as const,
        transform(code: string, id: string) {
          if (!/[/\\]paper[/\\]dist[/\\]paper-full\.js(?:\?|$)/.test(id)) return;
          return code.replace("self = self || require('./node/self.js');", 'self = self || { navigator: { userAgent: "" } };')
            .replace(/if \(paper\.agent\.node\) \{\s*require\('\.\/node\/extend\.js'\)\(paper\);\s*\}/, '');
        },
      },
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
