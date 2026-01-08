import type * as configs from './model.configs'
import type * as rowModule from './model.row'
import type * as rowDetailsSkipLogic from './model.rowDetails.skipLogic'
import type * as surveyModule from './model.survey'
import type * as utils from './model.utils'

/**
 * The aggregated Model namespace for dkobo_xlform.
 * This combines classes from survey and row modules, along with helper utilities and skip logic controllers.
 */
export interface ModelModule {
  // Classes from model.survey
  Survey: typeof surveyModule.Survey
  Settings: typeof surveyModule.Settings

  // Classes from model.row
  Row: typeof rowModule.Row
  BaseRow: typeof rowModule.BaseRow
  RowError: typeof rowModule.RowError

  // Helper Modules
  rowDetailsSkipLogic: typeof rowDetailsSkipLogic
  utils: typeof utils
  configs: typeof configs

  /** List of all keys exported by this module */
  _keys: string[]
}

declare const model: ModelModule
export default model
