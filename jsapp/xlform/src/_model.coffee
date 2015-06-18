###
dkobo_xlform.model[...]
###
define 'cs!xlform/_model', [
        'underscore',
        'cs!xlform/model.survey',
        'cs!xlform/model.utils',
        'cs!xlform/model.row',
        'xlform/model.rowDetails.skipLogic',
        'cs!xlform/model.configs',
        ], (
            _,
            $survey,
            $utils,
            $row,
            $rowDetailsSkipLogic,
            $configs,
            )->

  model = {}

  _.extend(model,
                 $survey,
                 $row,
                 )

  model._keys = _.keys(model)
  model.rowDetailsSkipLogic = $rowDetailsSkipLogic
  model.utils = $utils
  model.configs = $configs

  model
