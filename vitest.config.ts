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
		setupFiles: './src/__tests__/setup.ts',
		clearMocks: true,
		restoreMocks: true,
		css: {
			modules: {
				classNameStrategy: 'non-scoped',
			},
		},
		projects: [
			{ extends: true, test: { name: 'jsdom', environment: 'jsdom' } },
			{ extends: true, test: { name: 'happy-dom', environment: 'happy-dom' } },
		],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			exclude: [
				'node_modules/',
				'src/test/',
				'src/index.ts',
				'src/types.ts',
				'**/*.d.ts',
				'**/*.config.*',
			],
		},
	},
	resolve: {
		alias: {
			'@': resolve('./src'),
		},
	},
})
