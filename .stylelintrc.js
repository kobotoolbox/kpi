module.exports = {
  extends: 'stylelint-config-standard-scss',
  defaultSeverity: 'warning',
  rules: {
    'at-rule-empty-line-before': null,
    'at-rule-name-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'at-rule-name-space-after': [
      'always-single-line',
      {
        severity: 'warning',
      },
    ],
    'at-rule-semicolon-newline-after': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'block-no-empty': true,
    'block-closing-brace-empty-line-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'block-closing-brace-newline-after': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'block-closing-brace-newline-before': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'block-closing-brace-space-before': [
      'never-single-line',
      {
        severity: 'warning',
      },
    ],
    'block-opening-brace-newline-after': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'block-opening-brace-space-after': [
      'never-single-line',
      {
        severity: 'warning',
      },
    ],
    'block-opening-brace-space-before': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'color-no-invalid-hex': true,
    'color-hex-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'comment-no-empty': true,
    'comment-empty-line-before': null,
    'comment-whitespace-inside': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'custom-property-empty-line-before': null,
    'declaration-block-no-duplicate-properties': [
      true,
      {
        severity: 'warning',
      },
    ],
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-block-no-shorthand-property-overrides': [
      true,
      {
        severity: 'warning',
      },
    ],
    'declaration-bang-space-after': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'declaration-bang-space-before': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'declaration-block-semicolon-newline-after': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'declaration-block-semicolon-space-after': [
      'always-single-line',
      {
        severity: 'warning',
      },
    ],
    'declaration-block-semicolon-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'declaration-block-single-line-max-declarations': [
      1,
      {
        severity: 'warning',
      },
    ],
    'declaration-block-trailing-semicolon': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'declaration-colon-newline-after': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'declaration-colon-space-after': [
      'always-single-line',
      {
        severity: 'warning',
      },
    ],
    'declaration-colon-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'declaration-empty-line-before': null,
    'font-family-no-duplicate-names': true,
    'font-family-no-missing-generic-family-keyword': [
      true,
      {
        severity: 'warning',
      },
    ],
    'function-calc-no-unspaced-operator': [
      true,
      {
        severity: 'warning',
      },
    ],
    'function-linear-gradient-no-nonstandard-direction': true,
    'function-comma-newline-after': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'function-comma-space-after': [
      'always-single-line',
      {
        severity: 'warning',
      },
    ],
    'function-comma-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'function-max-empty-lines': [
      0,
      {
        severity: 'warning',
      },
    ],
    'function-name-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'function-parentheses-newline-inside': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'function-parentheses-space-inside': [
      'never-single-line',
      {
        severity: 'warning',
      },
    ],
    'function-whitespace-after': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'keyframe-declaration-no-important': [
      true,
      {
        severity: 'warning',
      },
    ],
    'length-zero-no-unit': [
      true,
      {
        severity: 'warning',
      },
    ],
    'max-empty-lines': [
      1,
      {
        severity: 'warning',
      },
    ],
    'media-feature-name-no-unknown': true,
    'media-feature-colon-space-after': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'media-feature-colon-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'media-feature-name-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'media-feature-parentheses-space-inside': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'media-feature-range-operator-space-after': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'media-feature-range-operator-space-before': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'media-query-list-comma-newline-after': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'media-query-list-comma-space-after': [
      'always-single-line',
      {
        severity: 'warning',
      },
    ],
    'media-query-list-comma-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    // somewhat useful, yet often frivolous. removing for now.
    'no-descending-specificity': null,
    'no-duplicate-at-import-rules': true,
    'no-duplicate-selectors': [
      true,
      {
        severity: 'warning',
      },
    ],
    'no-empty-source': true,
    'no-extra-semicolons': [
      true,
      {
        severity: 'warning',
      },
    ],
    // don't show warnings. trust editorconfig to:
    //  - trim end-of-line whitespace
    //  - ensure end-of-file newline
    'no-eol-whitespace': null,
    'no-missing-end-of-source-newline': null,

    'no-invalid-double-slash-comments': [
      true,
      {
        severity: 'warning',
      },
    ],
    'number-leading-zero': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'number-no-trailing-zeros': [
      true,
      {
        severity: 'warning',
      },
    ],
    'property-no-unknown': [
      true,
      {
        severity: 'warning',
      },
    ],
    'property-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'rule-empty-line-before': [
      'always-multi-line',
      {
        except: ['first-nested'],
        ignore: ['after-comment'],
        severity: 'warning',
      },
    ],
    // allows files like "badge.module.scss"
    'scss/at-import-partial-extension': null,
    // allow group lists of variables with empty lines as separators
    'scss/dollar-variable-empty-line-before': null,
    // same as comment-empty-line-before
    'scss/double-slash-comment-empty-line-before': null,
    'scss/operator-no-newline-before': null,
    'selector-class-pattern': null,
    'selector-pseudo-class-no-unknown': true,
    'selector-pseudo-element-no-unknown': true,
    'selector-type-no-unknown': true,
    'selector-attribute-brackets-space-inside': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'selector-attribute-operator-space-after': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'selector-attribute-operator-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'selector-combinator-space-after': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'selector-combinator-space-before': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'selector-descendant-combinator-no-non-space': [
      true,
      {
        severity: 'warning',
      },
    ],
    'selector-list-comma-newline-after': [
      'always',
      {
        severity: 'warning',
      },
    ],
    'selector-list-comma-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'selector-max-empty-lines': [
      0,
      {
        severity: 'warning',
      },
    ],
    'selector-pseudo-class-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'selector-pseudo-class-parentheses-space-inside': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'selector-pseudo-element-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'selector-pseudo-element-colon-notation': [
      'double',
      {
        severity: 'warning',
      },
    ],
    'selector-type-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'string-no-newline': [true, {severity: 'warning'}],
    'string-quotes': ['single', {severity: 'warning', avoidEscape: true}],
    'unit-no-unknown': true,
    'unit-case': [
      'lower',
      {
        severity: 'warning',
      },
    ],
    'value-list-comma-newline-after': [
      'always-multi-line',
      {
        severity: 'warning',
      },
    ],
    'value-list-comma-space-after': [
      'always-single-line',
      {
        severity: 'warning',
      },
    ],
    'value-list-comma-space-before': [
      'never',
      {
        severity: 'warning',
      },
    ],
    'value-list-max-empty-lines': [
      0,
      {
        severity: 'warning',
      },
    ],
  },
};
