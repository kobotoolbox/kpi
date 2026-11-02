/**
 * Points `${name}` references at new question names, e.g. `${gender}` -> `${gender_001}` when a Library block is
 * added again. Also covers `${last-saved#name}`. Names missing from `renames` stay as they are.
 */
export function renameQuestionReferences(text: string, renames: Record<string, string>): string {
  // `${`, an optional `last-saved#`, then the name (anything up to the first `}`), then `}`
  return text.replace(/\$\{(last-saved#)?([^}]+)\}/g, (match, prefix: string | undefined, name: string) =>
    Object.prototype.hasOwnProperty.call(renames, name) ? `\${${prefix ?? ''}${renames[name]}}` : match,
  )
}
