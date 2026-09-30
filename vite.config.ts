import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { demoApiPlugin } from './server/http';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OPENAI_');
  for (const name of ['OPENAI_API_KEY', 'OPENAI_MODEL']) if (!process.env[name] && env[name]) process.env[name] = env[name];
  return { plugins: [demoApiPlugin(), react(), tailwindcss()] };
});
