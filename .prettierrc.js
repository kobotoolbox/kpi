// .prettierrc.js
module.exports = {
  ...require('./node_modules/kobo-common/src/configs/.prettierrc.js'),
  overrides: [
    {
      files: ["cypress/**/*.js"],
      options: {
        semi: false, // Cypress style
      },
    },
  ],
};
