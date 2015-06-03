define 'cs!xlform/_view', [
        'underscore',
        'cs!xlform/view.surveyApp',
        'cs!xlform/view.utils',
        'cs!xlform/view.rowDetail.SkipLogic',
        ], (
            _,
            $surveyApp,
            $viewUtils,
            $viewRowDetailSkipLogic,
            )->

  view = {}

  _.extend(view,
                $surveyApp
                )

  view.utils = $viewUtils
  view.rowDetailSkipLogic = $viewRowDetailSkipLogic

  view
