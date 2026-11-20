// `${`, an optional `last-saved#`, then the name (anything up to the first `}`), then `}`
const REFERENCE_REGEX = /\$\{(last-saved#)?([^}]+)\}/g

/**
 * Points `${name}` references at new question names, e.g. `${gender}` -> `${gender_001}` when a Library block is
 * added again. Also covers `${last-saved#name}`. Names missing from `renames` stay as they are.
 */
export function renameQuestionReferences(text: string, renames: Record<string, string>): string {
  return text.replace(REFERENCE_REGEX, (match, prefix: string | undefined, name: string) =>
    Object.prototype.hasOwnProperty.call(renames, name) ? `\${${prefix ?? ''}${renames[name]}}` : match,
  )
}

/** Whether `text` has a `${name}` (or `${last-saved#name}`) reference. */
export function hasQuestionReference(text: string, name: string): boolean {
  return Array.from(text.matchAll(REFERENCE_REGEX)).some((match) => match[2] === name)
}
