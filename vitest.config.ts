/*
 *   IMPORTS
 ***************************************************************************************************/
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/*
 *   VITEST CONFIG
 ***************************************************************************************************/
export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: './src/__tests__/setup.ts',
		css: {
			modules: {
				classNameStrategy: 'non-scoped',
			},
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'src/test/', 'src/index.ts', 'src/types.ts', '**/*.d.ts', '**/*.config.*', '**/mockData/**', '**/dist/**'],
		},
	},
	resolve: {
		alias: {
			'@': resolve('./src'),
		},
	},
})
