import { Box, Text } from '@mantine/core'
import { IconWorldFilled } from '@tabler/icons-react'
import ButtonNew from '#/components/common/ButtonNew'
import type { AssetResponse } from '#/dataInterface'

interface FormLandingLanguagesProps {
  asset: AssetResponse
  canEdit: boolean
  onManageLanguages: () => void
}

export default function FormLandingLanguages({ asset, canEdit, onManageLanguages }: FormLandingLanguagesProps) {
  const translations = asset.content?.translations
  const hasLanguagesDefined = Boolean(translations && (translations.length > 1 || translations[0] !== null))

  return (
    <Box className='form-view__cell form-view__cell--columns form-view__cell--padding form-view__cell--bordertop'>
      <Box className='form-view__cell form-view__cell--translation-list'>
        <Text component='strong' fw={700}>
          {t('Languages:')}
        </Text>
        &nbsp;
        {!hasLanguagesDefined && t('This project has no languages defined yet')}
        {hasLanguagesDefined && (
          <ul>
            {translations?.map((language, index) => (
              <li key={index}>{language || t('Unnamed language')}</li>
            ))}
          </ul>
        )}
      </Box>

      {canEdit && (
        <Box className='form-view__cell'>
          <ButtonNew variant='outline' size='md' rightIcon={IconWorldFilled} onClick={onManageLanguages}>
            {t('Manage')}
          </ButtonNew>
        </Box>
      )}
    </Box>
  )
}
