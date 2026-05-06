import React from 'react'

import { IconPencilFilled, IconTrashFilled, IconWorldCog, IconWorldStar, IconX } from '@tabler/icons-react'
import bem from '#/bem'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/button'
import InlineMessage from '#/components/common/inlineMessage'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import LanguageForm from '#/components/modalForms/languageForm'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import type { LangObject } from '#/utils'
import { LANGUAGE_SUPPORT_URL } from './types'

interface LanguagesEditorProps {
  asset: AssetResponse
  translations: Array<string | null>
  isUpdatingAsset: boolean
  showAddLanguageForm: boolean
  renameLanguageIndex: number | -1
  onRequestClose: () => void
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
    <React.Fragment>
      <bem.FormView__cell m='translation-actions'>
        <Button type='text' size='m' onClick={props.onRequestClose} label={t('Close')} />
      </bem.FormView__cell>

      {!props.translations.length && (
        <bem.FormView__cell>{t('There is nothing to translate in this form.')}</bem.FormView__cell>
      )}

      {props.translations.length === 1 && props.translations[0] === null && (
        <React.Fragment>
          <bem.FormView__cell m='translation-note'>
            <p>{t('Here you can add more languages to your project, and translate the strings in each of them.')}</p>
            <p>
              {t('For the language code field, we suggest using the')}
              <a
                target='_blank'
                href='https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry'
              >
                {' ' + t('official language code') + ' '}
              </a>
              {t('(e.g. "English (en)" or "Rohingya (rhg)").')}
              {envStore.isReady && envStore.data.support_url && (
                <a target='_blank' href={envStore.data.support_url + LANGUAGE_SUPPORT_URL}>
                  {' ' + t('Read more.')}
                </a>
              )}
            </p>
          </bem.FormView__cell>

          <bem.FormView__cell m='translation'>
            <strong>{t('Please name your default language before adding languages and translations.')}</strong>
          </bem.FormView__cell>

          <bem.FormView__cell m='update-language-form'>
            <LanguageForm
              isPending={props.isUpdatingAsset}
              onLanguageChange={props.onLanguageChange}
              existingLanguages={props.translations}
              isDefault
            />
          </bem.FormView__cell>
        </React.Fragment>
      )}

      {props.translations.length > 0 && !(props.translations.length === 1 && props.translations[0] === null) && (
        <React.Fragment>
          <bem.FormView__cell m='label'>{t('Current languages')}</bem.FormView__cell>

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
            <React.Fragment key={`lang-${index}`}>
              <bem.FormView__cell m='translation'>
                <bem.FormView__cell m='translation-name'>
                  {lang}

                  {index === 0 && <bem.FormView__label m='default-language'>{t('default')}</bem.FormView__label>}

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
                </bem.FormView__cell>

                <bem.FormView__cell m='translation-actions'>
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
                </bem.FormView__cell>
              </bem.FormView__cell>

              {props.renameLanguageIndex === index && (
                <bem.FormView__cell m='update-language-form'>
                  <LanguageForm
                    isPending={props.isUpdatingAsset}
                    langString={lang}
                    langIndex={index}
                    onLanguageChange={props.onLanguageChange}
                    existingLanguages={props.translations}
                  />
                </bem.FormView__cell>
              )}
            </React.Fragment>
          ))}

          {!props.showAddLanguageForm && (
            <bem.FormView__cell m='add-language'>
              <Button
                type='primary'
                size='l'
                onClick={() => {
                  props.onToggleAddLanguageForm(true)
                }}
                isDisabled={!canAddLanguages || !canEditLanguages}
                label={t('Add language')}
              />
            </bem.FormView__cell>
          )}

          {props.showAddLanguageForm && (
            <bem.FormView__cell m='add-language-form'>
              <Button
                className='add-language-form-close'
                type='text'
                size='m'
                onClick={() => {
                  props.onToggleAddLanguageForm(false)
                }}
                startIcon='close'
              />

              <bem.FormView__cell m='label'>{t('Add a new language')}</bem.FormView__cell>

              <LanguageForm
                isPending={props.isUpdatingAsset}
                onLanguageChange={props.onLanguageChange}
                existingLanguages={props.translations}
              />
            </bem.FormView__cell>
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  )
}
