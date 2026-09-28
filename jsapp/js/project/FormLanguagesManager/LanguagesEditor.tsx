import React from 'react'

import { Anchor, Badge, Box, Group, Paper, Stack, Text } from '@mantine/core'
import { IconPencilFilled, IconTrashFilled, IconWorldCog, IconWorldStar, IconExternalLink, IconInfoCircle, IconLanguage } from '@tabler/icons-react'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import InlineMessage from '#/components/common/inlineMessage'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import type { AssetResponse } from '#/dataInterface'
import { DOCS_PATHS, getDocUrl } from '#/docsUrls'
import envStore from '#/envStore'
import type { LangObject } from '#/utils'
import LanguageForm from './LanguageForm'


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
      {!props.translations.length && <Text style={{ color: '#64748b' }}>{t('There is nothing to translate in this form.')}</Text>}

      {props.translations.length === 1 && props.translations[0] === null && (
        <Stack gap='md'>
          <Paper
            withBorder
            p='md'
            radius='md'
            style={{
              background: 'var(--color-primary-subtle, rgba(41, 185, 242, 0.06))',
              borderColor: 'rgba(41, 185, 242, 0.2)',
              borderRadius: 'var(--radius-lg, 12px)',
            }}
          >
            <Group wrap='nowrap' align='center' gap='sm'>
              <IconInfoCircle size={20} style={{ color: '#0688ba', flexShrink: 0 }} />
              <Box style={{ flexGrow: 1 }}>
                <Text size='sm' fw={600} style={{ color: '#0f172a' }}>
                  {t('Language Configuration Guide')}
                </Text>
                <Text size='xs' style={{ color: 'var(--color-text-muted, #64748b)', lineHeight: 1.4 }}>
                  {t('Learn how to configure languages and translations for your forms in our documentation.')}
                </Text>
              </Box>
              <ButtonNew
                component='a'
                href={getDocUrl(DOCS_PATHS.CONFIGURACION_IDIOMAS)}
                target='_blank'
                variant='light'
                size='xs'
                rightIcon={IconExternalLink}
                style={{
                  backgroundColor: 'rgba(41, 185, 242, 0.15)',
                  color: '#0688ba',
                  borderRadius: '20px',
                  fontWeight: 600,
                  fontSize: '11px',
                  border: '1px solid rgba(41, 185, 242, 0.2)',
                }}
              >
                {t('View Guide')}
              </ButtonNew>
            </Group>
          </Paper>

          <Box>
            <Text size='sm' style={{ color: '#64748b' }}>
              {t('Here you can add more languages to your project, and translate the strings in each of them.')}
            </Text>
          </Box>

          <Text fw={700} size='sm' style={{ color: '#0f172a' }}>{t('Please name your default language before adding languages and translations.')}</Text>

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
          <Paper
            withBorder
            p='md'
            radius='md'
            style={{
              background: 'var(--color-primary-subtle, rgba(41, 185, 242, 0.06))',
              borderColor: 'rgba(41, 185, 242, 0.2)',
              borderRadius: 'var(--radius-lg, 12px)',
            }}
          >
            <Group wrap='nowrap' align='center' gap='sm'>
              <IconInfoCircle size={20} style={{ color: '#0688ba', flexShrink: 0 }} />
              <Box style={{ flexGrow: 1 }}>
                <Text size='sm' fw={600} style={{ color: '#0f172a' }}>
                  {t('Language Configuration Guide')}
                </Text>
                <Text size='xs' style={{ color: 'var(--color-text-muted, #64748b)', lineHeight: 1.4 }}>
                  {t('Learn how to manage multiple languages and translate your form content in our documentation.')}
                </Text>
              </Box>
              <ButtonNew
                component='a'
                href={getDocUrl(DOCS_PATHS.CONFIGURACION_IDIOMAS)}
                target='_blank'
                variant='light'
                size='xs'
                rightIcon={IconExternalLink}
                style={{
                  backgroundColor: 'rgba(41, 185, 242, 0.15)',
                  color: '#0688ba',
                  borderRadius: '20px',
                  fontWeight: 600,
                  fontSize: '11px',
                  border: '1px solid rgba(41, 185, 242, 0.2)',
                }}
              >
                {t('View Guide')}
              </ButtonNew>
            </Group>
          </Paper>

          <Text fw={600} size='sm' style={{ color: '#0f172a' }}>{t('Current languages')}</Text>

          {props.translations[0] === null && (
            <InlineMessage
              type='warning'
              icon='alert'
              message={t(
                'You have named translations in your form but the default translation is unnamed. Please specify a default translation or make an existing one default.',
              )}
            />
          )}

          {props.translations.map((lang, index) => (
            <Stack key={`lang-${index}`} gap='xs'>
              <Paper
                withBorder
                p='md'
                radius='md'
                style={{
                  borderLeft: index === 0 ? '4px solid #29b9f2' : '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                }}
              >
                <Group justify='space-between' wrap='nowrap' align='center'>
                  <Group gap='sm'>
                    <IconLanguage size={18} style={{ color: index === 0 ? '#0688ba' : '#64748b' }} />
                    <Text fw={index === 0 ? 600 : 500} size='sm' style={{ color: '#0f172a' }}>
                      {lang || t('Unnamed language')}
                    </Text>

                    {index === 0 && <Badge variant='light' color='blue'>{t('default')}</Badge>}

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
                      disabled={props.isUpdatingAsset || !canEditLanguages || props.renameLanguageIndex === index}
                      icon={IconPencilFilled}
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
                      aria-label={t('Update translations')}
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
                    onCancel={() => props.onToggleRenameLanguage(index)}
                  />
                </Box>
              )}
            </Stack>
          ))}

          {!props.showAddLanguageForm && (
            <Box>
              <ButtonNew
                variant='filled'
                size='md'
                onClick={() => {
                  props.onToggleAddLanguageForm(true)
                }}
                disabled={!canAddLanguages || !canEditLanguages}
                style={{
                  backgroundColor: 'var(--color-primary-dark, #0688ba)',
                  color: '#ffffff',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontWeight: 600,
                }}
              >
                {t('Add language')}
              </ButtonNew>
            </Box>
          )}

          {props.showAddLanguageForm && (
            <Stack gap='sm'>
              <Text fw={600} size='sm' style={{ color: '#0f172a' }}>{t('Add a new language')}</Text>

              <LanguageForm
                isPending={props.isUpdatingAsset}
                onLanguageChange={props.onLanguageChange}
                existingLanguages={props.translations}
                onCancel={() => props.onToggleAddLanguageForm(false)}
              />
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  )
}
