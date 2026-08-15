// .eslintrc.js
module.exports = {
	root: true,
	extends: ['plugin:n8n-nodes-base/community'],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	env: {
		node: true,
		es2020: true,
	},
	ignorePatterns: ['dist', 'node_modules', 'coverage'],
	rules: {
		'@typescript-eslint/no-explicit-any': 'warn',
	},
};
