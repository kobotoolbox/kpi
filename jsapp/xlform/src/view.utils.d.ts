import type * as Validator from './view.utils.validator'

/**
 * Interface for the Debug Frame utility (a floating code block on screen).
 * Note: I have never used it and have never seen it being mentioned in 8 years as I work here :)
 */
export interface DebugFrame {
  (txt: string): void
  close(): void
}

/** Options for launching the Enketo Iframe */
export interface EnketoOptions {
  enketoPreviewUri?: string
  enketoServer?: string
  previewServer?: string
  onError?: (message: string, options?: any) => void
  onSuccess?: () => void
  [key: string]: any
}

/**
 * The Enketo Iframe manager.
 * Note: Some methods here might be legacy/unused (like `fromCsv`) but are typed for safety.
 */
export interface EnketoIframeLauncher {
  /** Loads a preview URL into an iframe */
  (previewUrl: string, options?: EnketoOptions): JQuery

  /** Removes the iframe and background overlay */
  close(): void

  /** Posts CSV data to a server to generate a preview URL, then launches it */
  fromCsv(surveyCsv: string, options?: EnketoOptions): void
}

/**
 * Utility functions for the view layer
 * Note: Some methods here might be legacy/unused (like `reorderElemsByData`) but are typed for safety.
 */
export interface ViewUtils {
  Validator: typeof Validator

  /** Replaces characters like ':', ' ', '(', ')' with dashes to make strings safe for event names */
  normalizeEventName(eventName: string): string

  /** Reorders DOM elements based on a numeric data attribute */
  reorderElemsByData(selector: string, parent: any, dataAttribute: string): void

  /** Converts an object of attributes into an HTML string of key="value" spans. Used for displaying errors. */
  cleanStringify(atts: Record<string, any>): string

  /** Displays a floating debug window with the provided text */
  debugFrame: DebugFrame

  /** Launches the question library UI? */
  launchQuestionLibrary: (opts?: any) => JQuery

  /** Manages the Enketo preview iframe */
  enketoIframe: EnketoIframeLauncher
}

declare const viewUtils: ViewUtils
export default viewUtils
