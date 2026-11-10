import { Group, Stack, Text } from '@mantine/core'
import ButtonNew from '#/components/common/ButtonNew'
import LanguagesSentence from './LanguagesSentence'

export interface AddOrDiscardLanguagesProps {
  /** Languages the library asset brings that the form doesn't have yet */
  languagesToAdd: string[]
  /** Insert the asset and add the languages */
  onAdd: () => void
  /** Insert the asset with these languages stripped out of it */
  onDiscard: () => void
}

/**
 * Asks whether a library asset's extra languages should join the form or be dropped. Some of its languages do fit, so
 * there is something to insert either way.
 */
export default function AddOrDiscardLanguages({ languagesToAdd, onAdd, onDiscard }: AddOrDiscardLanguagesProps) {
  return (
    <Stack gap='lg'>
      <Text>
        <LanguagesSentence
          sentence={t('Library asset includes languages that are not in your form: ##languages##.')}
          languages={languagesToAdd}
        />
      </Text>

      <Text>{t('Do you want to add these languages to the form or discard them?')}</Text>

      <Group justify='flex-end'>
        <ButtonNew variant='light' onClick={onDiscard}>
          {t('Discard languages')}
        </ButtonNew>
        <ButtonNew onClick={onAdd}>{t('Add languages')}</ButtonNew>
      </Group>
    </Stack>
  )
}
