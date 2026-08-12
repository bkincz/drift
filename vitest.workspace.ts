/*
 *   IMPORTS
 ***************************************************************************************************/
import { defineWorkspace } from 'vitest/config'

/*
 *   VITEST WORKSPACE
 ***************************************************************************************************/
export default defineWorkspace([
	{
		extends: './vitest.config.ts',
		test: {
			name: 'jsdom',
			environment: 'jsdom',
		},
	},
	{
		extends: './vitest.config.ts',
		test: {
			name: 'happy-dom',
			environment: 'happy-dom',
		},
	},
])
