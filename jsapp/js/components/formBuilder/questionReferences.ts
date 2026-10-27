/**
 * Points `${name}` references at new question names, e.g. `${gender}` -> `${gender_001}` when a Library block is
 * added again. Names missing from `renames` stay as they are.
 */
export function renameQuestionReferences(text: string, renames: Record<string, string>): string {
  // `${`, then the name (anything up to the first `}`), then `}`
  return text.replace(/\$\{([^}]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(renames, name) ? `\${${renames[name]}}` : match,
  )
}
