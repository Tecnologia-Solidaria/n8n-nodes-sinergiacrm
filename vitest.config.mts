// vitest.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// n8n-workflow@1.82.0 ships only `dist/`, but its package.json `exports`
// points the `import` condition at `src/index.ts`. Vitest then fails to
// resolve the entry, so we alias it to the installed CommonJS build.
const n8nWorkflowEntry = fileURLToPath(
	new URL('./node_modules/n8n-workflow/dist/index.js', import.meta.url),
);

export default defineConfig({
	resolve: {
		alias: {
			'n8n-workflow': n8nWorkflowEntry,
		},
	},
	test: {
		include: ['test/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: [
				'nodes/SinergiaCRM/helpers/**',
				'nodes/SinergiaCRM/methods.loadOptions.ts',
				'nodes/SinergiaCRM/SinergiaCRM.node.ts',
			],
			reporter: ['text'],
			thresholds: {
				lines: 80,
				statements: 80,
				functions: 80,
				branches: 70,
			},
		},
	},
});
