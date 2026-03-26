// 📘 generated from ./_model.civet 
/*
dkobo_xlform.model[...]
*/

import $survey from './model.survey'
import $utils from './model.utils'
import $row from './model.row'
import $rowDetailsSkipLogic from './model.rowDetails.skipLogic'
import $configs from './model.configs'

const _model = {...$survey, ...$row}
const model = {
  ..._model,
  _keys: Object.keys(_model),
  rowDetailsSkipLogic: $rowDetailsSkipLogic,
  utils: $utils,
  configs: $configs,
}

export default model
