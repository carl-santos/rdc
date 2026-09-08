import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Config separada para testes (Vitest). Mantém vite.config.ts focado no build.
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        css: false,
        // Valores dummy para o cliente Supabase inicializar sem rede em testes
        // (src/utils/supabase.ts lança erro se as envs não existirem).
        env: {
            VITE_SUPABASE_URL: 'http://localhost:54321',
            VITE_SUPABASE_ANON_KEY: 'test-anon-key',
        },
    },
});
