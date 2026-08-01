module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'import-newlines',
    ],
    extends: [
        'airbnb-typescript',
        'plugin:import/recommended',
        'plugin:import/typescript',
    ],
    parserOptions: {
        project: ['tsconfig.eslint.json'],
        ecmaFeatures: {
            jsx: true,
        },
    },
    overrides: [
        {
            files: ['scripts/**/*.ts', 'vitest.config.ts'],
            settings: {
                // The node resolver cannot resolve exports-only packages
                // (no `main` field), e.g. @rspack/core, archiver, and
                // vitest/config; the TypeScript resolver understands
                // package.json `exports`. Scoped to build scripts and
                // root tool configs so src/ lint output is unchanged.
                'import/resolver': {
                    typescript: {},
                },
            },
        },
    ],
    env: {
        browser: true,
        node: true,
    },
    rules: {
        indent: ['error', 4, { SwitchCase: 1 }],
        'max-len': ['error', { code: 120, ignoreUrls: true }],
        '@typescript-eslint/indent': ['error', 4],
        'arrow-body-style': 0,
        'react/jsx-filename-extension': 0,
        '@typescript-eslint/no-shadow': 0,
        'import/no-extraneous-dependencies': 'off',
        'import/no-cycle': 'off',
        'import/prefer-default-export': 'off',
        'import/extensions': 'off',
        'import-newlines/enforce': ['error', 2, 120],
        'import/order': [
            'error',
            {
                'groups': [
                    'builtin',
                    'external',
                    'internal',
                    'parent',
                    'sibling',
                    'index',
                    'object',
                ],
                'pathGroups': [
                    // Place all react libraries before external
                    {
                        'pattern': '*react*',
                        'group': 'external',
                        'position': 'before',
                    },
                    // Place all our libraries after react-like
                    {
                        'pattern': '@adguard/*',
                        'group': 'external',
                        'position': 'after',
                    },
                    // Separate group for all .pcss styles
                    {
                        'pattern': '*.pcss',
                        'group': 'object',
                        'patternOptions': { 'matchBase': true },
                        'position': 'after',
                    },
                ],
                'pathGroupsExcludedImportTypes': ['builtin', 'react'],
                'newlines-between': 'always',
                // To include "side effect imports" in plugin checks
                // (like "import 'styles.pcss';")
                'warnOnUnassignedImports': true,
            },
        ],
    },
};
