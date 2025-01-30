import _ from 'underscore'
import $surveyApp from './view.surveyApp'
import $viewUtils from './view.utils'
import $viewRowDetailSkipLogic from './view.rowDetail.SkipLogic'

export default do ->
  view = {}

  _.extend(view,
                $surveyApp
                )

  view.utils = $viewUtils
  view.rowDetailSkipLogic = $viewRowDetailSkipLogic

  view
