/**
 * Options for the sluggify function to control how strings are sanitized
 */
export interface SluggifyOptions {
  /** Strip spaces from beginning and end */
  lrstrip?: boolean
  /** Strip spaces from beginning */
  lstrip?: boolean
  /** Strip spaces from end */
  rstrip?: boolean
  /** Used in potential error messages */
  descriptor?: string
  /** Convert to lowercase */
  lowerCase?: boolean
  /** Replace all non-alphanumeric characters with underscores */
  replaceNonWordCharacters?: boolean
  /** String of characters to exclude from replacement */
  nonWordCharsExceptions?: string | false
  /** Replace multiple underscores (__) with a single one (_) */
  preventDuplicateUnderscores?: boolean
  /** Ensure the first character is not a digit (prepends underscore if so) */
  validXmlTag?: boolean
  /** Replace spaces with underscores */
  underscores?: boolean
  /** Maximum length of the resulting string */
  characterLimit?: number | false
  /** An array of existing names to avoid (will append _001, etc.) */
  preventDuplicates?: string[] | false
  /** Number of leading zeros for the duplicate incrementor (e.g. 3 => _001) */
  incrementorPadding?: number | false
}

/**
 * Utility functions for parsing skip logic and generating valid XML identifiers
 */
export interface Utils {
  skipLogicParser: any
  validationLogicParser: any

  /**
   * Parses a tab-delimited string (like a copy-paste from Excel)
   * into an array of objects.
   */
  split_paste(str: string): Array<Record<string, string>>

  parseHelper: {
    /**
     * Takes an XPath-like skip logic string and populates a
     * Backbone collection with logic criteria models.
     */
    parseSkipLogic(collection: any, value: string, parent_row: any): void
  }

  /**
   * Specialized sluggification for XLSForm labels.
   * Defaults to keeping case and ensuring XML tag validity.
   */
  sluggifyLabel(str: string, other_names?: string[]): string

  /**
   * Checks if a string conforms to XML tag naming rules.
   */
  isValidXmlTag(str: string): boolean

  /**
   * The core string transformation engine. Converts labels into
   * "slugs" (machine-readable IDs).
   */
  sluggify(str: string, opts?: SluggifyOptions): string
}

declare const utils: Utils
export default utils
