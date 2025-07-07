do ->
  $viewTemplates = require('./view.templates')
  $surveyApp = require('./view.surveyApp')

  return
    surveyApp: $surveyApp
    viewTemplates: $viewTemplates
