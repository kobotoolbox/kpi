// .prettierrc.js
module.exports = {
  editorconfig: true,
  // tabWidth comes from editorconfig
  // useTabs comes from editorconfig
  trailingComma: 'es5',
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: true,
  bracketSpacing: false,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: ['cypress/**/*.js'],
      options: {
        semi: false, // Cypress style
      },
    },
    {
      // Markdown configuration is mainly for our docs project (i.e. support.kobotoolbox.org)
      files: 'source/*.md',
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'always',
      },
    },
  ],
};
