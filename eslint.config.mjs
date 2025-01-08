import react from 'eslint-plugin-react';
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactQuery from '@tanstack/eslint-plugin-query';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';
import importPlugin from 'eslint-plugin-import';
import { fixupPluginRules } from "@eslint/compat";

const JS = `js,mjs,cjs,es6,jsx,mjsx`
const TS = `mjsx,ts,tsx,mtsx`

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const globalConfig = {
  name: 'global',
  files: [`**/*.{${JS},${TS}}`],
  ignores: ['jsapp/compiled'],
  extends: [
    eslint.configs.recommended,
    react.configs.flat.recommended,
    react.configs.flat['jsx-runtime'],
    reactQuery.configs['flat/recommended'], // https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query#eslint-plugin-query
    // eslintPluginReactHooks.configs.recommended, // See https://stackoverflow.com/a/78717978
  ],
  plugins: {
    "react-hooks": fixupPluginRules(reactHooks),
  },
  settings: {
    react: {
      version: "detect",
    },
    componentWrapperFunctions: ['observer'],
  },
  languageOptions: {
    ecmaVersion: 'latest',  // Otherwise errors on `.?` syntax.
    sourceType: 'module',
    parserOptions: {
      extraFileExtensions: ['.es6'],
    },
    // globals: {
    //   module: 'readonly',
    //   $: 'readonly',
    // },
  },
  linterOptions: {
    // noInlineConfig: true,
    reportUnusedDisableDirectives: 'error',
  },
  rules: {
    // ...reactHooks.configs.recommended.rules,
    'react-hooks/rules-of-hooks': 1, // TODO: make this an error, not warning
    'react-hooks/exhaustive-deps': 1,

    'no-empty-pattern': 1,
    'arrow-body-style': [1, 'as-needed', {requireReturnForObjectLiteral: true}],
    curly: 1,
    eqeqeq: 1,
    'max-nested-callbacks': [1, 6],
    'no-case-declarations': 1,
    'no-console': [1, {allow: ['info', 'warn', 'error']}],
    'no-control-regex': 0,
    'no-debugger': 1,
    'no-duplicate-imports': 1,
    'no-extend-native': 1,
    'no-extra-bind': 1,
    'no-extra-boolean-cast': 1,
    'no-fallthrough': 1,
    'no-inner-declarations': 1,
    'no-irregular-whitespace': 1,
    'no-lonely-if': 1,
    'no-nonoctal-decimal-escape': 1,
    'no-prototype-builtins': 1,
    'no-undef-init': 1,
    'no-undef': 1,
    'no-unexpected-multiline': 1,
    'no-unsafe-optional-chaining': 1,
    'no-unused-expressions': 1,
    'no-unused-vars': 1,
    'no-useless-backreference': 1,
    'no-useless-escape': 1,
    'no-useless-rename': 1,
    'no-var': 1,
    'one-var': ['warn', 'never'],
    'prefer-const': 1,
    'prefer-rest-params': 1,
    'react/jsx-boolean-value': 1,
    'react/jsx-no-undef': 2,
    'react/jsx-sort-prop-types': 0,
    'react/jsx-sort-props': 0,
    'react/jsx-uses-react': 2,
    'react/jsx-uses-vars': 2,
    'react/no-did-mount-set-state': 0,
    'react/no-did-update-set-state': 2,
    'react/no-multi-comp': 0,
    'react/no-unknown-property': 0,
    'react/prop-types': 0,
    // 'react/react-in-jsx-scope': 2,
    'react/self-closing-comp': 2,
    'react/wrap-multilines': 0,
    strict: 1,

    'no-extra-semi': 0,  // Explicitly turn off deprecated stylistic rule.

    // React Plugin - Default to plugin:react/recommended.
    //   https://github.com/jsx-eslint/eslint-plugin-react

    // TODO: Set these rules back to 'error' severity and fix the affected code
    // (1) comment these out (2) run npx eslint (...) with --quiet to list only errors
    // ===============================================================================
    // Deprecated API
    'react/no-deprecated': 1, // e.g. componentWillReceiveProps
    'react/no-find-dom-node': 1, // Do not use findDOMNode
    'react/no-string-refs': 1, // Using string literals in ref attributes is deprecated
    // Misuse
    'react/jsx-key': 1, // Missing "key" prop for element in iterator
    'react/no-direct-mutation-state': 1, // Do not mutate state directly. Use setState()
    // Other
    'react/display-name': 1, // "Component definition is missing display name"
    'react/no-unescaped-entities': 1, // e.g. `"` can be escaped with `&quot;`…

    // OK
    // ==
    'react/jsx-no-target-blank': 0, // Using target="_blank" without rel="noreferrer"
    // …not a problem for modern browsers; see 2021 update
    // (https://mathiasbynens.github.io/rel-noopener/#recommendations)

    // React Query - Default to plugin:@tanstack/eslint-plugin-query/recommended
    //  https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query


  },
};

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const jsConfig = {
  name: 'javascript',
  files: [`**/*.{${JS}}`],
  ignores: ['jsapp/compiled'],
  rules: {
  },
};

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const tsConfig = {
  name: 'typescript',
  files: [`**/*.{${TS}}`],
  ignores: ['jsapp/compiled'],
  extends: [
    tseslint.configs.recommended,
    importPlugin.flatConfigs.recommended, // https://github.com/import-js/eslint-plugin-import?tab=readme-ov-file#config---flat-with-config-in-typescript-eslint
    importPlugin.flatConfigs.typescript,
  ],
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        project: "./tsconfig.json",
      },
    },
  },
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    '@typescript-eslint/array-type': [1, {default: 'array-simple'}],
    // Would be good to enable in future, when most of codebase is TS.
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/ban-ts-comment': 1,
    '@typescript-eslint/consistent-type-definitions': [1, 'interface'],
    '@typescript-eslint/consistent-type-imports': [1, {prefer: 'type-imports'}],
    '@typescript-eslint/method-signature-style': [1, 'property'],
    '@typescript-eslint/naming-convention': [
      1,
      {
        selector: 'variableLike',
        format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
      },
      {selector: 'memberLike', format: ['camelCase', 'PascalCase', 'snake_case']},
      {selector: 'typeLike', format: ['PascalCase']},
      {
        selector: 'property',
        format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
      },
      {selector: 'method', format: ['camelCase']},
      {
        selector: [
          'classProperty',
          'objectLiteralProperty',
          'typeProperty',
          'classMethod',
          'objectLiteralMethod',
          'typeMethod',
          'accessor',
          'enumMember',
        ],
        format: null,
        modifiers: ['requiresQuotes'],
      },
    ],
    '@typescript-eslint/no-confusing-non-null-assertion': 1,
    '@typescript-eslint/no-dupe-class-members': 1,
    '@typescript-eslint/no-dynamic-delete': 1,
    '@typescript-eslint/no-empty-function': 1,
    '@typescript-eslint/no-empty-interface': 1,
    '@typescript-eslint/no-explicit-any': 1,
    '@typescript-eslint/no-inferrable-types': 1,
    '@typescript-eslint/no-invalid-void-type': 1,
    '@typescript-eslint/no-loop-func': 1,
    '@typescript-eslint/no-shadow': 1,
    '@typescript-eslint/no-this-alias': 1,
    '@typescript-eslint/no-unused-expressions': 1,
    '@typescript-eslint/no-unused-vars': 1,
    '@typescript-eslint/no-use-before-define': 1,
    '@typescript-eslint/no-useless-constructor': 1,
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/parameter-properties': 1,
    '@typescript-eslint/prefer-enum-initializers': 1,
    '@typescript-eslint/prefer-optional-chain': 1,
    '@typescript-eslint/sort-type-union-intersection-members': 'off',
    '@typescript-eslint/unified-signatures': 1,
    // The 'import' plugin supports separately importing types
    //   (@typescript-eslint/no-duplicate-imports is deprecated)
    'import/no-duplicates': 1,
    'import/no-named-as-default-member': 'off', // We are bundling constants and utils atm. TODO: review and refactor.
    // Turn off ESLint's version of this rule when in TypeScript
    'no-duplicate-imports': 'off',
    'no-nonoctal-decimal-escape': 'off',
    // It is recommended that this check is disabled for TS files, see:
    // https://typescript-eslint.io/docs/linting/troubleshooting/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
    'no-undef': 'off',
    'no-unsafe-optional-chaining': 'off',
    'no-unused-expressions': 'off',
    'no-unused-vars': 'off',
    'no-useless-backreference': 'off',
    'no-var': 1,

    // hmm why it was like this before? let's remove.
    'prefer-const': 1,
    'prefer-spread': 1,
  },
};

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const browserConfig = {
  name: 'browser',
  files: [`**/*.{${JS},${TS}}`],
  ignores: ['jsapp/compiled', `**/*.stories.{${JS},${TS}}`, `**/*.tests.{${JS},${TS}}`],
  languageOptions: {
    sourceType: 'module',
    parserOptions: {
      extraFileExtensions: ['.es6'],
    },
    globals: {
      ...globals.browser,
      't': 'readonly', // TODO: move to global.d.ts with proper types.
      '$': 'readonly', // TODO: move to global.d.ts with proper types.
    },
  },
};

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const storybookConfig = {
  name: 'story',
  files: [`**/*.stories.{${JS},${TS}}`],
  ignores: ['jsapp/compiled'],
  extends: [
    storybook.configs['flat/recommended'], // https://github.com/storybookjs/eslint-plugin-storybook?tab=readme-ov-file#configuration-eslintconfigcmjs
  ],
};

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const testsConfig = {
  name: 'test',
  files: [`**/*.tests.{${JS},${TS}}`],
  ignores: ['jsapp/compiled'],
  languageOptions: {
    sourceType: 'module',
    parserOptions: {
      extraFileExtensions: ['.es6'],
    },
    globals: {
      describe: 'readonly',
      it: 'readonly',
      before: 'readonly',
      beforeEach: 'readonly',
      after: 'readonly',
      afterEach: 'readonly',
      expect: 'readonly',
      chai: 'readonly',
      t: 'readonly',
    },
  },
};

export default tseslint.config(globalConfig, jsConfig, tsConfig, browserConfig, storybookConfig, testsConfig);
