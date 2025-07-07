/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
(function() {
  const $viewTemplates = require('./view.templates');
  const $surveyApp = require('./view.surveyApp');

  return {
    surveyApp: $surveyApp,
    viewTemplates: $viewTemplates
  };
})();
