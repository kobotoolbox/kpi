import { Text } from '@mantine/core'
import { Fragment } from 'react'
import { currentLang } from '#/utils'

export interface LanguagesSentenceProps {
  /** A translated sentence with a `##languages##` placeholder where the names go. */
  sentence: string
  /** Language strings in Kobo's `Name (code)` shape, e.g. `['English (en)', 'Polski (pl)']` */
  languages: string[]
}

/** Falls back to English when the UI language cookie holds something `Intl` won't take. */
function getListFormat() {
  try {
    return new Intl.ListFormat(currentLang(), { style: 'long', type: 'conjunction' })
  } catch {
    return new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })
  }
}

/**
 * A sentence with the language names in bold where its placeholder was, joined the way the UI language joins a list -
 * "a, b, and c" in English.
 */
export default function LanguagesSentence({ sentence, languages }: LanguagesSentenceProps) {
  // Empty default covers a translation that drops the placeholder
  const [beforeLanguages, afterLanguages = ''] = sentence.split('##languages##')

  return (
    <>
      {beforeLanguages}
      {getListFormat()
        .formatToParts(languages)
        .map((part, index) => (
          <Fragment key={`${part.type}-${index}`}>
            {part.type === 'element' ? (
              <Text span fw={700} inherit>
                {part.value}
              </Text>
            ) : (
              part.value
            )}
          </Fragment>
        ))}
      {afterLanguages}
    </>
  )
}
