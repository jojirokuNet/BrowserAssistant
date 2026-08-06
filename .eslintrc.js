/**
 * @file ESLint configuration of the repository.
 */
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
        'plugin:jsdoc/recommended-error',
    ],
    parserOptions: {
        project: ['tsconfig.eslint.json'],
        ecmaFeatures: {
            jsx: true,
        },
    },
    overrides: [
        {
            files: ['tests/**'],
            rules: {
                // Mirror browser-extension: test files need no file
                // overview block.
                'jsdoc/require-file-overview': 'off',
            },
        },
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
        // ---- JSDoc completeness tier (eslint-plugin-jsdoc) ----
        // The completeness rules check any existing doc block; presence
        // rules (require-jsdoc, require-file-overview) are later issues.
        'jsdoc/require-param': [
            'error',
            {
                contexts: [
                    'ArrowFunctionExpression',
                    'FunctionDeclaration',
                    'FunctionExpression',
                ],
                // Destructured parameters: tag the root, not each field.
                checkDestructured: false,
            },
        ],
        'jsdoc/require-param-description': 'error',
        'jsdoc/require-returns': [
            'error',
            {
                contexts: [
                    'ArrowFunctionExpression',
                    'FunctionDeclaration',
                    'FunctionExpression',
                ],
            },
        ],
        'jsdoc/require-returns-description': 'error',
        'jsdoc/require-returns-check': 'error',
        'jsdoc/check-param-names': ['error', { checkDestructured: false }],
        'jsdoc/require-description-complete-sentence': [
            'error',
            { abbreviations: ['e.g.', 'i.e.'] },
        ],
        // TypeScript carries the types; tags carry prose only.
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/require-throws-type': 'off',
        // Presence rules: classes, function declarations, methods and class
        // properties must carry a doc block with a description. The
        // typescript-eslint v5 parser emits PropertyDefinition for class
        // properties; ClassProperty is the ESTree name other parsers emit
        // and is kept for parity with the browser-extension tier. The file
        // itself must open with a @file overview block (tests exempt).
        'jsdoc/require-jsdoc': [
            'error',
            {
                contexts: [
                    'ClassDeclaration',
                    'FunctionDeclaration',
                    'MethodDefinition',
                    'ClassProperty',
                    'PropertyDefinition',
                ],
            },
        ],
        // Doc blocks attached to those contexts must have a body description.
        'jsdoc/require-description': [
            'error',
            {
                contexts: [
                    'ClassDeclaration',
                    'FunctionDeclaration',
                    'MethodDefinition',
                    'ClassProperty',
                    'PropertyDefinition',
                ],
            },
        ],
        // Every linted file must open with a @file overview block. Test
        // files are exempt via the overrides block above.
        'jsdoc/require-file-overview': 'error',
        // ---- JSDoc style tier (eslint-plugin-jsdoc) ----
        // tag-lines is NOT overridden: the preset "never" stays, so the
        // dense tag layout is enforced as-is (no blank line between the
        // description and the first tag, none between tags). sort-tags
        // must set linesBetween: 0 explicitly — the plugin default is 1
        // and omitting the option re-introduces the blank-line conflict
        // with tag-lines that makes --fix oscillate (verified at 63.2.2).
        'jsdoc/sort-tags': [
            'error',
            {
                tagSequence: [
                    { tags: ['file'] },
                    { tags: ['template', 'class', 'async'] },
                    { tags: ['note'] },
                    { tags: ['see'] },
                    { tags: ['param'] },
                    { tags: ['returns'] },
                    { tags: ['throws'] },
                    { tags: ['example'] },
                ],
                linesBetween: 0,
            },
        ],
        // TypeScript carries the types; tags carry prose only.
        'jsdoc/no-types': 'error',
        'jsdoc/require-hyphen-before-param-description': [
            'error',
            'never',
            {
                tags: {
                    param: 'never',
                    returns: 'never',
                    throws: 'never',
                    property: 'never',
                },
            },
        ],
        // Documented functions that throw must carry a @throws tag.
        'jsdoc/require-throws': 'error',
        // Advisory only: unknown tags warn (no --max-warnings=0 gate),
        // and the custom @note tag is allowed.
        'jsdoc/check-tag-names': [
            'warn',
            { definedTags: ['note'] },
        ],
    },
};
