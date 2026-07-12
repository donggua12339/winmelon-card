import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var apiBase = (_b = env.VITE_API_BASE) !== null && _b !== void 0 ? _b : 'http://localhost:3000';
    return {
        plugins: [
            vue(),
            AutoImport({
                imports: ['vue', 'vue-router', 'pinia'],
                resolvers: [ElementPlusResolver()],
                dts: 'src/auto-imports.d.ts',
            }),
            Components({
                resolvers: [ElementPlusResolver()],
                dts: 'src/components.d.ts',
            }),
        ],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            port: 5173,
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: apiBase,
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: 'dist',
            sourcemap: false,
            target: 'es2020',
            rollupOptions: {
                output: {
                    manualChunks: {
                        vue: ['vue', 'vue-router', 'pinia'],
                        ui: ['element-plus'],
                    },
                },
            },
        },
    };
});
