import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

/*
 *   VITE CONFIG
 ***************************************************************************************************/
// https://vite.dev/config/
export default defineConfig({
	plugins: [
		dts({
			include: ['src/**/*'],
			exclude: ['src/__tests__/**', 'src/**/*.test.*', 'src/test/**'],
			rollupTypes: true,
			tsconfigPath: './tsconfig.lib.json',
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'Drift',
			fileName: 'drift',
			formats: ['es', 'umd'],
		},
		rollupOptions: {
			external: ['@bkincz/clutch', 'immer'],
			output: {
				globals: {
					'@bkincz/clutch': 'Clutch',
					immer: 'immer',
				},
			},
		},
	},
	resolve: {
		alias: {
			'@': resolve('./src'),
		},
	},
})
