(function() {
  const $viewTemplates = require('./view.templates');
  const $surveyApp = require('./view.surveyApp');

  return{
    surveyApp: $surveyApp,
    viewTemplates: $viewTemplates
  };
})();
