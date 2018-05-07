###
dkobo_xlform.model[...]
###

_ = require 'underscore'
$survey = require './model.survey'
$utils = require './model.utils'
$row = require './model.row'
$rowDetailsSkipLogic = require './model.rowDetails.skipLogic'
$configs = require './model.configs'

module.exports = do ->

  model = {}

  _.extend(model, $survey, $row)

  model._keys = _.keys(model)
  model.rowDetailsSkipLogic = $rowDetailsSkipLogic
  model.utils = $utils
  model.configs = $configs

  model
