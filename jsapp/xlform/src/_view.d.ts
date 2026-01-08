import type * as RowDetailSkipLogicModule from './view.rowDetail.SkipLogic'
import type * as SurveyAppModule from './view.surveyApp'
import type * as ViewUtilsModule from './view.utils'

/**
 * The aggregated view namespace. It merges the exports from `view.surveyApp` (the main app shell) and attaches helper
 * modules for utilities and skip logic.
 */
export type ViewModule = typeof SurveyAppModule & {
  utils: typeof ViewUtilsModule
  rowDetailSkipLogic: typeof RowDetailSkipLogicModule
}

declare const view: ViewModule
export default view
