import { Stack, Text } from '@mantine/core'
import LanguagesSentence from './LanguagesSentence'

export interface ConfirmAddLanguagesProps {
  languagesToAdd: string[]
}

/**
 * Warns that the asset shares no language with the form: inserting it adds all of its languages and leaves the form's
 * own ones untranslated here.
 */
export default function ConfirmAddLanguages({ languagesToAdd }: ConfirmAddLanguagesProps) {
  return (
    <Stack gap='sm'>
      <Text>
        <LanguagesSentence
          sentence={t(
            'Library asset does not match your form languages. If you continue, ##languages## will be added to your form.',
          )}
          languages={languagesToAdd}
        />
      </Text>

      <Text>{t('You will need to add translations for the existing form languages manually.')}</Text>
    </Stack>
  )
}
