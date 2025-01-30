###
dkobo_xlform.model[...]
###

import _ from 'underscore'
import $survey from './model.survey'
import $utils from './model.utils'
import $row from './model.row'
import $rowDetailsSkipLogic from './model.rowDetails.skipLogic'
import $configs from './model.configs'

export default do ->

  model = {}

  _.extend(model, $survey, $row)

  model._keys = _.keys(model)
  model.rowDetailsSkipLogic = $rowDetailsSkipLogic
  model.utils = $utils
  model.configs = $configs

  model
