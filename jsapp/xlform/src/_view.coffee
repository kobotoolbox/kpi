_ = require 'underscore'
$surveyApp = require './view.surveyApp'
$viewUtils = require './view.utils'
$viewRowDetailSkipLogic = require './view.rowDetail.SkipLogic'

module.exports = do ->
  view = {}

  _.extend(view,
                $surveyApp
                )

  view.utils = $viewUtils
  view.rowDetailSkipLogic = $viewRowDetailSkipLogic

  view
