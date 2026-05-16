const globals = require('globals');
const js = require('@eslint/js');

const importPlugin = require('eslint-plugin-import');
const spellcheck = require('eslint-plugin-spellcheck');
const writeGoodComments = require('eslint-plugin-write-good-comments');

module.exports = [
	{
		ignores: ['**/node_modules'],
	},
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: globals.builtin,
		},
	},
	{
		files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
		plugins: {
			import: importPlugin,
			'write-good-comments': writeGoodComments,
			spellcheck,
		},
		rules: {
			'no-console': 'warn',
			'no-nested-ternary': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
			'comma-dangle': ['error', 'only-multiline'],
			'no-prototype-builtins': 'off',

			// TODO This rule doesn't work after updating to eslint 9
			// https://github.com/import-js/eslint-plugin-import/pull/2829
			// 'import/no-unused-modules': [1, { unusedExports: true }],

			'import/no-unresolved': [1, { ignore: ['bun', 'bun:test', String.raw`\.asText$`] }],
			'import/no-useless-path-segments': 'error',
			'import/first': 'warn',
			'import/order': 'warn',

			'write-good-comments/write-good-comments': 'warn',

			'spellcheck/spell-checker': ['warn', require('./spellcheck.config.cjs')],
		},
	},
	{
		files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
		languageOptions: {
			globals: {
				...globals.node,
				Bun: false,
			},
		},
		rules: {
			'no-console': 'off',
		},
	},
	{
		files: ['test-setup.js', '**/*.test.js'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
				Bun: false,
				mock: true,
				spyOn: true,
				setSystemTime: true,
			},
		},
		rules: {
			'no-console': 'off',
		},
	},
];
