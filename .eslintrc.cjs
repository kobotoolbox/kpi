const jsRules = {
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
  'prefer-spread': 1,
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

  // Formatting (stylistic) rules.
  //
  // 'Deprecated' in ESLint 8.53.0, see announcement
  // - Announcement: https://eslint.org/blog/2023/10/deprecating-formatting-rules/
  // - Rules deprecated: (https://github.com/eslint/eslint/commit/528e1c00dc2a)
  //
  // Successor: ESLint Stylistic, community project
  // - Rules: https://eslint.style/packages/default#rules
  //
  // It'll be useful to keep a variant of these rules around as an alternative
  // "auto-fixer" (versus Prettier), since Prettier modifies line wrappings in
  // a way that can harm code readability at times.
  //
  // Idea:
  //  * Create a 'stylistic-only' ESLint config with these rules
  //  * Use the stylistic config for 'auto-fix' (lightweight formatting) in editor
  //    (normalize quotes, commas, semicolons, etc. without touching linebreaks)
  //  * Remove 'stylistic' rules from the main config, to reduce diagnostic
  //    clutter in code or in the 'Problems' pane
  //  * Keep an optional well-configured 'Prettier' tooling, able to run on
  //    modified lines or current/selected paragraph, around for convenience
  'arrow-parens': [1, 'always'],
  'arrow-spacing': 1,
  'block-spacing': [1, 'never'],
  'brace-style': [1, '1tbs', {allowSingleLine: true}],
  'comma-dangle': [1, 'always-multiline'],
  'comma-spacing': [1, {before: false, after: true}],
  'eol-last': [1, 'always'],
  'func-call-spacing': 1,
  'jsx-quotes': ['warn', 'prefer-single'],
  'key-spacing': [1, {beforeColon: false, afterColon: true, mode: 'strict'}],
  'no-confusing-arrow': 1,
  'no-extra-semi': 1,
  'no-mixed-spaces-and-tabs': 1,
  'no-multi-spaces': 1, // Comment out to permit columnar formatting
  'no-multiple-empty-lines': [1, {max: 2, maxEOF: 1}],
  'no-trailing-spaces': 1,
  'no-whitespace-before-property': 1,
  'quotes': ['warn', 'single', {avoidEscape: true}],
  'semi-spacing': [1, {before: false, after: true}],
  'semi-style': [1, 'last'],
  'semi': 1,
  'space-before-function-paren': 'off',
  'space-in-parens': [1, 'never'],
  'space-infix-ops': 1,

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


  // React Hooks - Default to plugin:react-hooks/recommended
  //  https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks

  // TODO: Fix these! They should be errors, too.
  'react-hooks/rules-of-hooks': 1, // TODO: make this an error, not warning

  // React Query - Default to plugin:@tanstack/eslint-plugin-query/recommended
  //  https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query

};

// TypeScript rules override some of JavaScript rules plus add a few more.
const tsRules = Object.assign({}, jsRules, {
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

  // Formatting (stylistic) rules, for TypeScript.
  // 'Deprecated' in @typescript-eslint v6.16.0 (https://typescript-eslint.io/blog/deprecating-formatting-rules/),
  // Still useful for us in some form, particularly with auto-fix.
  // See "Formatting (stylistic) rules" comment, above.
  '@typescript-eslint/comma-dangle': [1, 'always-multiline'],
  '@typescript-eslint/comma-spacing': [1, {before: false, after: true}],
  '@typescript-eslint/func-call-spacing': [1, 'never'],
  '@typescript-eslint/keyword-spacing': [1, {before: true, after: true}],
  '@typescript-eslint/no-extra-parens': 'off',
  '@typescript-eslint/no-extra-semi': 1,
  '@typescript-eslint/object-curly-spacing': 1,
  '@typescript-eslint/member-delimiter-style': [1, {
    multiline: {delimiter: 'semi'},
    singleline: {delimiter: 'semi'},
  }],
  '@typescript-eslint/quotes': ['warn', 'single', {avoidEscape: true}],
  '@typescript-eslint/semi': 1,
  '@typescript-eslint/type-annotation-spacing': [1, {
    before: false,
    after: true,
    overrides: {
      arrow: {
        before: true,
        after: true,
      },
    },
  }],
  '@typescript-eslint/space-before-function-paren': [1, {
    anonymous: 'always',
    named: 'never',
    asyncArrow: 'always',
  }],
  // Turn off equivalent ESLint rules
  'comma-dangle': 'off',
  'comma-spacing': 'off',
  'func-call-spacing': 'off',
  'no-extra-semi': 'off',
  'quotes': 'off',
  'semi': 'off',

});

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  ignorePatterns: ['**/*.scss'],
  plugins: ['react'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended', // Use recommended rules: https://github.com/jsx-eslint/eslint-plugin-react#list-of-supported-rules
    'plugin:react/jsx-runtime', // Use the new JSX transform
    'plugin:react-hooks/recommended', // Rules of Hooks (https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)
    'plugin:@tanstack/eslint-plugin-query/recommended', // For Tanstack Query (aka react-query)
    'prettier',
    'plugin:storybook/recommended'],
  rules: jsRules,
  settings: {
    react: {
      version: 'detect',
    },
    // https://github.com/jsx-eslint/eslint-plugin-react#configuration-legacy-eslintrc-
    // Try to include all the component wrapper functions we use here
    componentWrapperFunctions: [
      'observer', // MobX observer
    ],
    linkComponenets: [
      { name: 'Link', linkAttribute: 'to' }, // React Router Link
    ],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: [
        'react',
        '@typescript-eslint',
        // For import/no-duplicates
        // Could do more with it.
        'import',
      ],
      settings: {
        'import/resolver': {
          typescript: true,
        },
      },
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
      parserOptions: {
        project: ['./tsconfig.json'],
      },
      rules: tsRules,
    },
  ],
  globals: {
    inject: false,
    module: false,
    describe: false,
    it: false,
    before: false,
    beforeEach: false,
    after: false,
    afterEach: false,
    expect: false,
    window: false,
    document: false,
    Parse: false,
    chai: true,
    t: 'readonly',
    $: 'readonly',
    ga: 'readonly',
  },
};
