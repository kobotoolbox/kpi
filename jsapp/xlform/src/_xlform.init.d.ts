import type model from './_model'
import type view from './_view'

// We haven't explicitly typed 'mv.skipLogicHelpers' yet,
// but we know it's used in the helper namespace.
// You can replace 'any' with a specific import if you generate that d.ts later.
type SkipLogicHelpers = any

/**
 * The Root Interface for the dkobo_xlform library.
 * This matches the structure returned by the `do ->` block in CoffeeScript.
 */
export interface XLFormModule {
  /**
   * The Model Layer.
   * Access core logic like Survey, Row, configs, and utilities here.
   * e.g., dkobo_xlform.model.Survey
   */
  model: typeof model

  /**
   * The View Layer.
   * Access UI components like SurveyApp and view utilities here.
   * e.g., dkobo_xlform.view.SurveyApp
   */
  view: typeof view

  /**
   * Helper Modules.
   * Currently contains the static skip logic definitions.
   */
  helper: {
    skipLogic: SkipLogicHelpers
  }
}

declare const XLF: XLFormModule

export default XLF
