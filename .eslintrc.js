module.exports = {
  extends: ['./node_modules/kobo-common/src/configs/.eslintrc.js', 'plugin:storybook/recommended'],
  overrides: [{
    files: ['cypress/**/*.js'],
    globals: {
      cy: 'readonly',
      Cypress: 'readonly'
    },
    rules: {
      semi: ['warn', 'never'] // Cypress style
    }
  }]
};