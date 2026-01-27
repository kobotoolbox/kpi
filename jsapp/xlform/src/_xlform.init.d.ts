import type model from './_model'
import type view from './_view'
import type skipLogicHelpers from './xlform/src/skipLogicHelpers'

type SkipLogicHelpers = typeof skipLogicHelpers

/** The Root Interface for the "dkobo_xlform" library */
export interface XLFormModule {
  model: typeof model
  view: typeof view
  helper: {
    skipLogic: SkipLogicHelpers
  }
}

declare const XLF: XLFormModule
export default XLF
