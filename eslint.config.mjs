import eslint from '@eslint/js'
import reactQuery from '@tanstack/eslint-plugin-query'
import importPlugin from 'eslint-plugin-import'
import react from 'eslint-plugin-react'
import globals from 'globals'
import tseslint from 'typescript-eslint'

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
  ],
  settings: {
    react: {
      version: 'detect',
    },
    componentWrapperFunctions: ['observer'],
  },
  languageOptions: {
    ecmaVersion: 'latest', // Otherwise errors on `.?` syntax.
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
    reportUnusedDisableDirectives: 'warn', // TODO: set to error, not that many places.
  },
  rules: {
    'arrow-body-style': [1, 'as-needed', { requireReturnForObjectLiteral: true }],
    'max-nested-callbacks': [1, 6],
    'no-duplicate-imports': 1,
    'no-extend-native': 1,
    'no-extra-bind': 1,
    'no-unexpected-multiline': 1,
    'no-unused-expressions': 1,
    'no-useless-backreference': 1,
    'prefer-rest-params': 1,
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

    'no-extra-semi': 0, // Explicitly turn off deprecated stylistic rule.

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
    'react/no-direct-mutation-state': 1, // Do not mutate state directly. Use setState()
    // Other
    'react/display-name': 1, // "Component definition is missing display name"
    'react/no-unescaped-entities': 1, // e.g. `"` can be escaped with `&quot;`…

    // OK
    // ==
    // …not a problem for modern browsers; see 2021 update
    // (https://mathiasbynens.github.io/rel-noopener/#recommendations)

    // React Query - Default to plugin:@tanstack/eslint-plugin-query/recommended
    //  https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query
  },
}

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const jsConfig = {
  name: 'javascript',
  files: [`**/*.{${JS}}`],
  ignores: ['jsapp/compiled'],
  rules: {},
}

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
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        project: './tsconfig.json',
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
    // Would be good to enable in future, when most of codebase is TS.
    '@typescript-eslint/ban-ts-comment': 1,
    '@typescript-eslint/consistent-type-definitions': [1, 'interface'],
    '@typescript-eslint/method-signature-style': [1, 'property'],
    '@typescript-eslint/naming-convention': [
      // TODO move to biome
      1,
      {
        selector: 'variableLike',
        format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
      },
      { selector: 'memberLike', format: ['camelCase', 'PascalCase', 'snake_case'] },
      { selector: 'typeLike', format: ['PascalCase'] },
      {
        selector: 'property',
        format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
      },
      { selector: 'method', format: ['camelCase'] },
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
    '@typescript-eslint/no-dynamic-delete': 1,
    '@typescript-eslint/no-loop-func': 1,
    '@typescript-eslint/no-shadow': 1,
    '@typescript-eslint/no-unused-expressions': 1,
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/parameter-properties': 1,
    '@typescript-eslint/sort-type-union-intersection-members': 'off',
    '@typescript-eslint/unified-signatures': 1,
    // The 'import' plugin supports separately importing types
    //   (@typescript-eslint/no-duplicate-imports is deprecated)
    'import/no-duplicates': 1,
    'import/no-named-as-default-member': 'off', // We are bundling constants and utils atm. TODO: review and refactor.
    // Turn off ESLint's version of this rule when in TypeScript
    'no-duplicate-imports': 'off',
    // It is recommended that this check is disabled for TS files, see: (update: link is dead)
    // https://typescript-eslint.io/docs/linting/troubleshooting/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
    'no-unused-expressions': 'off',
    'no-useless-backreference': 'off',

    // hmm why it was like this before? let's remove.
    'prefer-spread': 1,
  },
}

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
      t: 'readonly', // TODO: move to global.d.ts with proper types.
      $: 'readonly', // TODO: move to global.d.ts with proper types.
    },
  },
}

/** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
const storybookConfig = {
  name: 'story',
  files: [`**/*.stories.{${JS},${TS}}`],
  ignores: ['jsapp/compiled'],
  extends: [
    // storybook.configs['flat/recommended'], // https://github.com/storybookjs/eslint-plugin-storybook?tab=readme-ov-file#configuration-eslintconfigcmjs
  ],
}

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
}

/**
 * Explicitly disable rules covered by Biome.
 * @type {import('typescript-eslint').InfiniteDepthConfigWithExtends}
 */
const biomeConfig = {
  // name: 'biome',
  // files: [`**/*.{${JS},${TS}}`],
  // ignores: ['jsapp/compiled'],
  languageOptions: {
    parserOptions: {
      extraFileExtensions: ['.es6'],
    },
  },
  rules: {
    // new in eslint v8, See https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/#replacement-of-ban-types
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'off',
    '@typescript-eslint/no-wrapper-object-types': 'off',

    '@mysticatea/eslint-plugin/no-this-in-static': 'off', // noThisInStatic (inspired)
    '@next/eslint-plugin-next/google-font-display': 'off', // useGoogleFontDisplay
    '@next/eslint-plugin-next/no-document-import-in-page': 'off', // noDocumentImportInPage
    '@next/eslint-plugin-next/no-head-element': 'off', // noHeadElement
    '@next/eslint-plugin-next/no-head-import-in-document': 'off', // noHeadImportInDocument
    '@next/eslint-plugin-next/no-img-element': 'off', // noImgElement
    'constructor-super': 'off', // noInvalidConstructorSuper
    curly: 'off', // useBlockStatements
    'default-case': 'off', // useDefaultSwitchClause
    'default-case-last': 'off', // useDefaultSwitchClauseLast
    'default-param-last': 'off', // useDefaultParameterLast
    'dot-notation': 'off', // useLiteralKeys
    eqeqeq: 'off', // noDoubleEquals
    'for-direction': 'off', // useValidForDirection
    'getter-return': 'off', // useGetterReturn
    'guard-for-in': 'off', // useGuardForIn
    'no-array-constructor': 'off', // useArrayLiterals
    'no-async-promise-executor': 'off', // noAsyncPromiseExecutor
    'no-case-declarations': 'off', // noSwitchDeclarations
    'no-class-assign': 'off', // noClassAssign
    'no-compare-neg-zero': 'off', // noCompareNegZero
    'no-cond-assign': 'off', // noAssignInExpressions (inspired)
    'no-console': 'off', // noConsole
    'no-const-assign': 'off', // noConstAssign
    'no-constant-condition': 'off', // noConstantCondition
    'no-constructor-return': 'off', // noConstructorReturn
    'no-control-regex': 'off', // noControlCharactersInRegex
    'no-debugger': 'off', // noDebugger
    'no-dupe-args': 'off', // noDuplicateParameters
    'no-dupe-class-members': 'off', // noDuplicateClassMembers
    'no-dupe-else-if': 'off', // noDuplicateElseIf
    'no-dupe-keys': 'off', // noDuplicateObjectKeys
    'no-duplicate-case': 'off', // noDuplicateCase
    'no-else-return': 'off', // noUselessElse (inspired)
    'no-empty': 'off', // noEmptyBlockStatements
    'no-empty-character-class': 'off', // noEmptyCharacterClassInRegex
    'no-empty-function': 'off', // noEmptyBlockStatements
    'no-empty-pattern': 'off', // noEmptyPattern
    'no-empty-static-block': 'off', // noEmptyBlockStatements
    'no-eval': 'off', // noGlobalEval
    'no-ex-assign': 'off', // noCatchAssign
    'no-extra-boolean-cast': 'off', // noExtraBooleanCast
    'no-extra-label': 'off', // noUselessLabel
    'no-fallthrough': 'off', // noFallthroughSwitchClause
    'no-func-assign': 'off', // noFunctionAssign
    'no-global-assign': 'off', // noGlobalAssign
    'no-import-assign': 'off', // noImportAssign
    'no-inner-declarations': 'off', // noInnerDeclarations
    'no-irregular-whitespace': 'off', // noIrregularWhitespace
    'no-label-var': 'off', // noLabelVar
    'no-labels': 'off', // noConfusingLabels (inspired)
    'no-lone-blocks': 'off', // noUselessLoneBlockStatements
    'no-lonely-if': 'off', // useCollapsedElseIf
    'no-loss-of-precision': 'off', // noPrecisionLoss
    'no-misleading-character-class': 'off', // noMisleadingCharacterClass
    'no-negated-condition': 'off', // noNegationElse
    'no-nested-ternary': 'off', // noNestedTernary
    'no-new-native-nonconstructor': 'off', // noInvalidBuiltinInstantiation
    'no-new-symbol': 'off', // noNewSymbol
    'no-new-wrappers': 'off', // useConsistentBuiltinInstantiation
    'no-nonoctal-decimal-escape': 'off', // noNonoctalDecimalEscape
    'no-obj-calls': 'off', // noGlobalObjectCalls
    'no-octal-escape': 'off', // noOctalEscape
    'no-param-reassign': 'off', // noParameterAssign
    'no-prototype-builtins': 'off', // noPrototypeBuiltins
    'no-redeclare': 'off', // noRedeclare
    'no-regex-spaces': 'off', // noMultipleSpacesInRegularExpressionLiterals
    'no-restricted-globals': 'off', // noRestrictedGlobals
    'no-restricted-imports': 'off', // noRestrictedImports
    'no-self-assign': 'off', // noSelfAssign
    'no-self-compare': 'off', // noSelfCompare
    'no-sequences': 'off', // noCommaOperator
    'no-setter-return': 'off', // noSetterReturn
    'no-shadow-restricted-names': 'off', // noShadowRestrictedNames
    'no-sparse-arrays': 'off', // noSparseArray
    'no-template-curly-in-string': 'off', // noTemplateCurlyInString
    'no-this-before-super': 'off', // noUnreachableSuper
    'no-throw-literal': 'off', // useThrowOnlyError (inspired)
    'no-undef': 'off', // noUndeclaredVariables
    'no-undef-init': 'off', // noUselessUndefinedInitialization
    'no-unneeded-ternary': 'off', // noUselessTernary
    'no-unreachable': 'off', // noUnreachable
    'no-unsafe-finally': 'off', // noUnsafeFinally
    'no-unsafe-negation': 'off', // noUnsafeNegation
    'no-unsafe-optional-chaining': 'off', // noUnsafeOptionalChaining
    'no-unused-labels': 'off', // noUnusedLabels
    'no-unused-private-class-members': 'off', // noUnusedPrivateClassMembers
    'no-unused-vars': 'off', // noUnusedVariables
    'no-use-before-define': 'off', // noInvalidUseBeforeDeclaration
    'no-useless-catch': 'off', // noUselessCatch
    'no-useless-concat': 'off', // noUselessStringConcat
    'no-useless-constructor': 'off', // noUselessConstructor
    'no-useless-escape': 'off', // noUselessEscapeInRegex
    'no-useless-rename': 'off', // noUselessRename
    'no-var': 'off', // noVar
    'no-void': 'off', // noVoid
    'no-with': 'off', // noWith
    'one-var': 'off', // useSingleVarDeclarator
    'operator-assignment': 'off', // useShorthandAssign
    'prefer-arrow-callback': 'off', // useArrowFunction (inspired)
    'prefer-const': 'off', // useConst
    'prefer-exponentiation-operator': 'off', // useExponentiationOperator
    'prefer-numeric-literals': 'off', // useNumericLiterals
    'prefer-object-has-own': 'off', // noPrototypeBuiltins
    'prefer-regex-literals': 'off', // useRegexLiterals
    'prefer-rest-params': 'off', // noArguments (inspired)
    'prefer-template': 'off', // useTemplate
    'require-await': 'off', // useAwait
    'require-yield': 'off', // useYield
    'use-isnan': 'off', // useIsNan
    'valid-typeof': 'off', // useValidTypeof
    yoda: 'off', // noYodaExpression
    'graphql-eslint/no-duplicate-fields': 'off', // noDuplicatedFields
    'graphql-eslint/require-deprecation-reason': 'off', // useDeprecatedReason
    'stylelint/block-no-empty': 'off', // noEmptyBlock
    'stylelint/custom-property-no-missing-var-function': 'off', // noMissingVarFunction
    'stylelint/declaration-block-no-duplicate-custom-properties': 'off', // noDuplicateCustomProperties
    'stylelint/declaration-block-no-duplicate-properties': 'off', // noDuplicateProperties
    'stylelint/declaration-block-no-shorthand-property-overrides': 'off', // noShorthandPropertyOverrides
    'stylelint/font-family-no-duplicate-names': 'off', // noDuplicateFontNames
    'stylelint/font-family-no-missing-generic-family-keyword': 'off', // useGenericFontNames
    'stylelint/function-linear-gradient-no-nonstandard-direction': 'off', // noInvalidDirectionInLinearGradient
    'stylelint/function-no-unknown': 'off', // noUnknownFunction
    'stylelint/keyframe-block-no-duplicate-selectors': 'off', // noDuplicateSelectorsKeyframeBlock
    'stylelint/keyframe-declaration-no-important': 'off', // noImportantInKeyframe
    'stylelint/media-feature-name-no-unknown': 'off', // noUnknownMediaFeatureName
    'stylelint/named-grid-areas-no-invalid': 'off', // noInvalidGridAreas
    'stylelint/no-descending-specificity': 'off', // noDescendingSpecificity (inspired)
    'stylelint/no-duplicate-at-import-rules': 'off', // noDuplicateAtImportRules
    'stylelint/no-invalid-position-at-import-rule': 'off', // noInvalidPositionAtImportRule
    'stylelint/no-irregular-whitespace': 'off', // noIrregularWhitespace
    'stylelint/property-no-unknown': 'off', // noUnknownProperty
    'stylelint/selector-anb-no-unmatchable': 'off', // noUnmatchableAnbSelector
    'stylelint/selector-pseudo-class-no-unknown': 'off', // noUnknownPseudoClass
    'stylelint/selector-pseudo-element-no-unknown': 'off', // noUnknownPseudoElement
    'stylelint/selector-type-no-unknown': 'off', // noUnknownTypeSelector
    'stylelint/unit-no-unknown': 'off', // noUnknownUnit
    'eslint-plugin-barrel-files/avoid-barrel-files': 'off', // noBarrelFile (inspired)
    'eslint-plugin-barrel-files/avoid-namespace-import': 'off', // noNamespaceImport
    'eslint-plugin-barrel-files/avoid-re-export-all': 'off', // noReExportAll
    'eslint-plugin-import/no-commonjs': 'off', // noCommonJs (inspired)
    'eslint-plugin-import/no-default-export': 'off', // noDefaultExport
    'eslint-plugin-import/no-extraneous-dependencies': 'off', // noUndeclaredDependencies
    'eslint-plugin-import/no-nodejs-modules': 'off', // noNodejsModules
    'eslint-plugin-import-access/eslint-plugin-import-access': 'off', // useImportRestrictions (inspired)
    'eslint-plugin-jest/max-nested-describe': 'off', // noExcessiveNestedTestSuites
    'eslint-plugin-jest/no-disabled-tests': 'off', // noSkippedTests (inspired)
    'eslint-plugin-jest/no-done-callback': 'off', // noDoneCallback (inspired)
    'eslint-plugin-jest/no-duplicate-hooks': 'off', // noDuplicateTestHooks (inspired)
    'eslint-plugin-jest/no-export': 'off', // noExportsInTest (inspired)
    'eslint-plugin-jest/no-focused-tests': 'off', // noFocusedTests (inspired)
    'eslint-plugin-jest/no-standalone-expect': 'off', // noMisplacedAssertion (inspired)
    'eslint-plugin-jsx-a11y/alt-text': 'off', // useAltText
    'eslint-plugin-jsx-a11y/anchor-has-content': 'off', // useAnchorContent
    'eslint-plugin-jsx-a11y/anchor-is-valid': 'off', // useValidAnchor
    'eslint-plugin-jsx-a11y/aria-activedescendant-has-tabindex': 'off', // useAriaActivedescendantWithTabindex
    'eslint-plugin-jsx-a11y/aria-props': 'off', // useValidAriaProps
    'eslint-plugin-jsx-a11y/aria-proptypes': 'off', // useValidAriaValues
    'eslint-plugin-jsx-a11y/aria-role': 'off', // useValidAriaRole
    'eslint-plugin-jsx-a11y/aria-unsupported-elements': 'off', // noAriaUnsupportedElements
    'eslint-plugin-jsx-a11y/autocomplete-valid': 'off', // useValidAutocomplete
    'eslint-plugin-jsx-a11y/click-events-have-key-events': 'off', // useKeyWithClickEvents
    'eslint-plugin-jsx-a11y/heading-has-content': 'off', // useHeadingContent
    'eslint-plugin-jsx-a11y/html-has-lang': 'off', // useHtmlLang
    'eslint-plugin-jsx-a11y/iframe-has-title': 'off', // useIframeTitle
    'eslint-plugin-jsx-a11y/img-redundant-alt': 'off', // noRedundantAlt
    'eslint-plugin-jsx-a11y/interactive-supports-focus': 'off', // useFocusableInteractive
    'eslint-plugin-jsx-a11y/label-has-associated-control': 'off', // noLabelWithoutControl
    'eslint-plugin-jsx-a11y/lang': 'off', // useValidLang
    'eslint-plugin-jsx-a11y/media-has-caption': 'off', // useMediaCaption
    'eslint-plugin-jsx-a11y/mouse-events-have-key-events': 'off', // useKeyWithMouseEvents
    'eslint-plugin-jsx-a11y/no-access-key': 'off', // noAccessKey (inspired)
    'eslint-plugin-jsx-a11y/no-aria-hidden-on-focusable': 'off', // noAriaHiddenOnFocusable
    'eslint-plugin-jsx-a11y/no-autofocus': 'off', // noAutofocus
    'eslint-plugin-jsx-a11y/no-distracting-elements': 'off', // noDistractingElements
    'eslint-plugin-jsx-a11y/no-interactive-element-to-noninteractive-role': 'off', // noInteractiveElementToNoninteractiveRole
    'eslint-plugin-jsx-a11y/no-noninteractive-element-to-interactive-role': 'off', // noNoninteractiveElementToInteractiveRole
    'eslint-plugin-jsx-a11y/no-noninteractive-tabindex': 'off', // noNoninteractiveTabindex
    'eslint-plugin-jsx-a11y/no-redundant-roles': 'off', // noRedundantRoles
    'eslint-plugin-jsx-a11y/no-static-element-interactions': 'off', // noStaticElementInteractions
    'eslint-plugin-jsx-a11y/prefer-tag-over-role': 'off', // useSemanticElements
    'eslint-plugin-jsx-a11y/role-has-required-aria-props': 'off', // useAriaPropsForRole
    'eslint-plugin-jsx-a11y/role-supports-aria-props': 'off', // useAriaPropsSupportedByRole
    'eslint-plugin-jsx-a11y/scope': 'off', // noHeaderScope
    'eslint-plugin-jsx-a11y/tabindex-no-positive': 'off', // noPositiveTabindex
    'eslint-plugin-n/no-process-env': 'off', // noProcessEnv (inspired)
    'eslint-plugin-no-secrets/no-secrets': 'off', // noSecrets (inspired)
    'react/button-has-type': 'off', // useButtonType
    'react/jsx-boolean-value': 'off', // noImplicitBoolean (inspired)
    'react/jsx-curly-brace-presence': 'off', // useConsistentCurlyBraces (inspired)
    'react/jsx-fragments': 'off', // useFragmentSyntax
    'react/jsx-key': 'off', // useJsxKeyInIterable
    'react/jsx-no-comment-textnodes': 'off', // noCommentText
    'react/jsx-no-duplicate-props': 'off', // noDuplicateJsxProps
    'react/jsx-no-target-blank': 'off', // noBlankTarget
    'react/jsx-no-useless-fragment': 'off', // noUselessFragments
    'react/no-array-index-key': 'off', // noArrayIndexKey (inspired)
    'react/no-children-prop': 'off', // noChildrenProp
    'react/no-danger': 'off', // noDangerouslySetInnerHtml
    'react/no-danger-with-children': 'off', // noDangerouslySetInnerHtmlWithChildren
    'react/void-dom-elements-no-children': 'off', // noVoidElementsWithChildren
    'react-hooks/exhaustive-deps': 'off', // useExhaustiveDependencies (inspired)
    'react-hooks/rules-of-hooks': 'off', // useHookAtTopLevel
    'react-refresh/only-export-components': 0, // useComponentExportOnlyModules (inspired)
    'eslint-plugin-solid/no-react-specific-props': 'off', // noReactSpecificProps (inspired)
    'eslint-plugin-sonarjs/cognitive-complexity': 'off', // noExcessiveCognitiveComplexity (inspired)
    'eslint-plugin-sonarjs/prefer-while': 'off', // useWhile
    'eslint-plugin-stylistic/jsx-self-closing-comp': 'off', // useSelfClosingElements (inspired)
    'eslint-plugin-unicorn/error-message': 'off', // useErrorMessage
    'eslint-plugin-unicorn/explicit-length-check': 'off', // useExplicitLengthCheck
    'eslint-plugin-unicorn/filename-case': 'off', // useFilenamingConvention (inspired)
    'eslint-plugin-unicorn/new-for-builtins': 'off', // noInvalidBuiltinInstantiation
    'eslint-plugin-unicorn/no-array-for-each': 'off', // noForEach
    'eslint-plugin-unicorn/no-document-cookie': 'off', // noDocumentCookie (inspired)
    'eslint-plugin-unicorn/no-for-loop': 'off', // useForOf
    'eslint-plugin-unicorn/no-instanceof-array': 'off', // useIsArray
    'eslint-plugin-unicorn/no-lonely-if': 'off', // useCollapsedIf
    'eslint-plugin-unicorn/no-static-only-class': 'off', // noStaticOnlyClass
    'eslint-plugin-unicorn/no-thenable': 'off', // noThenProperty
    'eslint-plugin-unicorn/no-useless-switch-case': 'off', // noUselessSwitchCase
    'eslint-plugin-unicorn/prefer-array-flat-map': 'off', // useFlatMap
    'eslint-plugin-unicorn/prefer-at': 'off', // useAtIndex (inspired)
    'eslint-plugin-unicorn/prefer-date-now': 'off', // useDateNow
    'eslint-plugin-unicorn/prefer-node-protocol': 'off', // useNodejsImportProtocol
    'eslint-plugin-unicorn/prefer-number-properties': 'off', // useNumberNamespace
    'eslint-plugin-unicorn/prefer-string-slice': 'off', // noSubstr
    'eslint-plugin-unicorn/prefer-string-trim-start-end': 'off', // useTrimStartEnd
    'eslint-plugin-unicorn/require-number-to-fixed-digits-argument': 'off', // useNumberToFixedDigitsArgument
    'eslint-plugin-unicorn/throw-new-error': 'off', // useThrowNewError
    'eslint-plugin-unused-imports/no-unused-imports': 'off', // noUnusedImports (inspired)
    'eslint-plugin-unused-imports/no-unused-vars': 'off', // noUnusedVariables
    '@typescript-eslint/adjacent-overload-signatures': 'off', // useAdjacentOverloadSignatures
    '@typescript-eslint/array-type': 'off', // useConsistentArrayType
    '@typescript-eslint/ban-types': 'off', // noBannedTypes (inspired)
    '@typescript-eslint/consistent-type-exports': 'off', // useExportType (inspired)
    '@typescript-eslint/consistent-type-imports': 'off', // useImportType (inspired)
    '@typescript-eslint/default-param-last': 'off', // useDefaultParameterLast
    '@typescript-eslint/dot-notation': 'off', // useLiteralKeys
    '@typescript-eslint/explicit-function-return-type': 'off', // useExplicitType
    '@typescript-eslint/explicit-member-accessibility': 'off', // useConsistentMemberAccessibility
    '@typescript-eslint/naming-convention': 'off', // useNamingConvention (inspired)
    '@typescript-eslint/no-array-constructor': 'off', // useArrayLiterals
    '@typescript-eslint/no-dupe-class-members': 'off', // noDuplicateClassMembers
    '@typescript-eslint/no-empty-function': 'off', // noEmptyBlockStatements
    '@typescript-eslint/no-empty-interface': 'off', // noEmptyInterface (inspired)
    '@typescript-eslint/no-explicit-any': 'off', // noExplicitAny
    '@typescript-eslint/no-extra-non-null-assertion': 'off', // noExtraNonNullAssertion
    '@typescript-eslint/no-extraneous-class': 'off', // noStaticOnlyClass
    '@typescript-eslint/no-inferrable-types': 'off', // noInferrableTypes
    '@typescript-eslint/no-invalid-void-type': 'off', // noConfusingVoidType
    '@typescript-eslint/no-loss-of-precision': 'off', // noPrecisionLoss
    '@typescript-eslint/no-misused-new': 'off', // noMisleadingInstantiator
    '@typescript-eslint/no-namespace': 'off', // noNamespace
    '@typescript-eslint/no-non-null-assertion': 'off', // noNonNullAssertion
    '@typescript-eslint/no-redeclare': 'off', // noRedeclare
    '@typescript-eslint/no-require-imports': 'off', // noCommonJs
    '@typescript-eslint/no-restricted-imports': 'off', // noRestrictedImports
    '@typescript-eslint/no-restricted-types': 'off', // noRestrictedTypes
    '@typescript-eslint/no-this-alias': 'off', // noUselessThisAlias (inspired)
    '@typescript-eslint/no-unnecessary-type-constraint': 'off', // noUselessTypeConstraint
    '@typescript-eslint/no-unsafe-declaration-merging': 'off', // noUnsafeDeclarationMerging
    '@typescript-eslint/no-unused-vars': 'off', // noUnusedVariables
    '@typescript-eslint/no-use-before-define': 'off', // noInvalidUseBeforeDeclaration
    '@typescript-eslint/no-useless-constructor': 'off', // noUselessConstructor
    '@typescript-eslint/no-useless-empty-export': 'off', // noUselessEmptyExport
    '@typescript-eslint/only-throw-error': 'off', // useThrowOnlyError (inspired)
    '@typescript-eslint/parameter-properties': 'off', // noParameterProperties (inspired)
    '@typescript-eslint/prefer-as-const': 'off', // useAsConstAssertion
    '@typescript-eslint/prefer-enum-initializers': 'off', // useEnumInitializers
    '@typescript-eslint/prefer-for-of': 'off', // useForOf
    '@typescript-eslint/prefer-function-type': 'off', // useShorthandFunctionType
    '@typescript-eslint/prefer-literal-enum-member': 'off', // useLiteralEnumMembers
    '@typescript-eslint/prefer-namespace-keyword': 'off', // useNamespaceKeyword
    '@typescript-eslint/prefer-optional-chain': 'off', // useOptionalChain
    '@typescript-eslint/require-await': 'off', // useAwait
  },
}

export default [
  ...tseslint.config(globalConfig, jsConfig, tsConfig, browserConfig, storybookConfig, testsConfig),
  biomeConfig,
]
