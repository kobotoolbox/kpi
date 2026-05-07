import React from 'react'

import { Anchor, Badge, Box, Group, Paper, Stack, Text } from '@mantine/core'
import { IconPencilFilled, IconTrashFilled, IconWorldCog, IconWorldStar, IconX } from '@tabler/icons-react'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import InlineMessage from '#/components/common/inlineMessage'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import type { LangObject } from '#/utils'
import LanguageForm from './LanguageForm'
import { LANGUAGE_SUPPORT_URL } from './types'

interface LanguagesEditorProps {
  asset: AssetResponse
  translations: Array<string | null>
  isUpdatingAsset: boolean
  showAddLanguageForm: boolean
  renameLanguageIndex: number | -1
  onToggleAddLanguageForm: (value: boolean) => void
  onToggleRenameLanguage: (index: number) => void
  onChangeDefaultLanguage: (index: number) => void
  onOpenTranslations: (index: number) => void
  onDeleteLanguage: (index: number) => void
  onLanguageChange: (lang: LangObject, index: number) => void | Promise<void>
}

export default function LanguagesEditor(props: LanguagesEditorProps) {
  const canAddLanguages = !(props.translations.length === 1 && props.translations[0] === null)
  const canEditLanguages = Boolean(
    props.asset?.content &&
      !hasAssetRestriction(props.asset.content, LockingRestrictionName.language_edit) &&
      canAddLanguages,
  )

  return (
    <Stack gap='md'>
      {!props.translations.length && <Text>{t('There is nothing to translate in this form.')}</Text>}

      {props.translations.length === 1 && props.translations[0] === null && (
        <Stack gap='sm'>
          <Box>
            <Text>
              {t('Here you can add more languages to your project, and translate the strings in each of them.')}
            </Text>
            <Text>
              {t('For the language code field, we suggest using the')}
              <Anchor
                target='_blank'
                href='https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry'
              >
                {' ' + t('official language code') + ' '}
              </Anchor>
              {t('(e.g. "English (en)" or "Rohingya (rhg)").')}
              {envStore.isReady && envStore.data.support_url && (
                <Anchor target='_blank' href={envStore.data.support_url + LANGUAGE_SUPPORT_URL}>
                  {' ' + t('Read more.')}
                </Anchor>
              )}
            </Text>
          </Box>

          <Text fw={700}>{t('Please name your default language before adding languages and translations.')}</Text>

          <Box>
            <LanguageForm
              isPending={props.isUpdatingAsset}
              onLanguageChange={props.onLanguageChange}
              existingLanguages={props.translations}
              isDefault
            />
          </Box>
        </Stack>
      )}

      {props.translations.length > 0 && !(props.translations.length === 1 && props.translations[0] === null) && (
        <Stack gap='md'>
          <Text fw={600}>{t('Current languages')}</Text>

          {props.translations[0] === null && (
            <InlineMessage
              type='warning'
              icon='alert'
              message={t(
                'You have named translations in your form but the default translation is unnamed. Please specifiy a default translation or make an existing one default.',
              )}
            />
          )}

          {props.translations.map((lang, index) => (
            <Stack key={`lang-${index}`} gap='xs'>
              <Paper withBorder p='sm'>
                <Group justify='space-between' wrap='nowrap' align='center'>
                  <Group gap='xs'>
                    <Text>{lang}</Text>

                    {index === 0 && <Badge variant='light'>{t('default')}</Badge>}

                    {index !== 0 && (
                      <ActionIcon
                        variant='transparent'
                        size='md'
                        onClick={() => {
                          props.onChangeDefaultLanguage(index)
                        }}
                        disabled={props.isUpdatingAsset || !canEditLanguages}
                        tooltip={t('Make default')}
                        icon={IconWorldStar}
                      />
                    )}
                  </Group>

                  <Group gap='xs'>
                    <ActionIcon
                      variant='light'
                      size='md'
                      onClick={() => {
                        props.onToggleRenameLanguage(index)
                      }}
                      disabled={props.isUpdatingAsset || !canEditLanguages}
                      icon={props.renameLanguageIndex === index ? IconX : IconPencilFilled}
                      tooltip={t('Edit language')}
                    />

                    <ActionIcon
                      variant='light'
                      size='md'
                      onClick={() => {
                        props.onOpenTranslations(index)
                      }}
                      disabled={props.isUpdatingAsset}
                      icon={IconWorldCog}
                      tooltip={t('Update translations')}
                    />

                    {index !== 0 && (
                      <ActionIcon
                        variant='danger-secondary'
                        size='md'
                        onClick={() => {
                          props.onDeleteLanguage(index)
                        }}
                        disabled={props.isUpdatingAsset || !canEditLanguages}
                        icon={IconTrashFilled}
                        tooltip={t('Delete language')}
                      />
                    )}
                  </Group>
                </Group>
              </Paper>

              {props.renameLanguageIndex === index && (
                <Box>
                  <LanguageForm
                    isPending={props.isUpdatingAsset}
                    langString={lang}
                    langIndex={index}
                    onLanguageChange={props.onLanguageChange}
                    existingLanguages={props.translations}
                  />
                </Box>
              )}
            </Stack>
          ))}

          {!props.showAddLanguageForm && (
            <Box>
              <ButtonNew
                variant='filled'
                size='lg'
                onClick={() => {
                  props.onToggleAddLanguageForm(true)
                }}
                disabled={!canAddLanguages || !canEditLanguages}
              >
                {t('Add language')}
              </ButtonNew>
            </Box>
          )}

          {props.showAddLanguageForm && (
            <Stack gap='sm'>
              <ButtonNew
                variant='transparent'
                size='md'
                onClick={() => {
                  props.onToggleAddLanguageForm(false)
                }}
                leftIcon='close'
              />

              <Text fw={600}>{t('Add a new language')}</Text>

              <LanguageForm
                isPending={props.isUpdatingAsset}
                onLanguageChange={props.onLanguageChange}
                existingLanguages={props.translations}
              />
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  )
}
