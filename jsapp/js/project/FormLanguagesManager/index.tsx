import React, { useEffect, useState } from 'react'

import { Box, Group } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useQuery } from '@tanstack/react-query'
import cloneDeep from 'lodash.clonedeep'
import type { PaginatedListResponse } from '#/UniversalTable'
import { assetsPartialUpdate } from '#/api/react-query/manage-projects-and-library-content'
import CloseButton from '#/components/common/CloseButton'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import type { AssetContent, AssetResponse } from '#/dataInterface'
import { stores } from '#/stores'
import { type LangObject, escapeHtml, getLangString, notify } from '#/utils'
import LanguagesEditor from './LanguagesEditor'
import TranslationsEditor from './TranslationsEditor'
import {
  type TranslationRowItem,
  type View,
  buildTranslationRows,
  deleteTranslations,
  prepareTranslations,
} from './types'

interface FormLanguagesManagerProps {
  asset: AssetResponse
  onRequestClose: () => void
  registerOnRequestClose?: (closeHandler: () => void) => void
}

export function openFormLanguagesModal(asset: AssetResponse) {
  let requestModalClose = () => {}

  const modalId = modals.open({
    title: (
      <Group justify='space-between' wrap='nowrap'>
        <Box>{t('Manage Languages')}</Box>
        <CloseButton aria-label={t('Close')} onClick={() => requestModalClose()} />
      </Group>
    ),
    size: '80%',
    // Keep default close button disabled and render a controlled one in title,
    // so close requests always go through FormLanguagesManager.requestClose.
    withCloseButton: false,
    // closeOnEscape and closeOnClickOutside are kept disabled because the
    // modals manager calls closeModal() directly, bypassing any guard logic.
    // Instead we intercept both events manually and route them through
    // FormLanguagesManager.requestClose (unsaved-changes confirmation):
    //   - Escape key: handled via onKeyDown on the content root Box
    //   - Overlay click: handled via overlayProps.onClick below
    closeOnEscape: false,
    closeOnClickOutside: false,
    overlayProps: {
      onClick: () => requestModalClose(),
    },
    children: (
      <FormLanguagesManager
        asset={asset}
        registerOnRequestClose={(closeHandler) => {
          requestModalClose = closeHandler
        }}
        onRequestClose={() => {
          modals.close(modalId)
        }}
      />
    ),
  })

  requestModalClose = () => {
    modals.close(modalId)
  }
}

export default function FormLanguagesManager(props: FormLanguagesManagerProps) {
  const [asset, setAsset] = useState(props.asset)
  const [activeView, setActiveView] = useState<View>('languages')
  const [selectedLangIndex, setSelectedLangIndex] = useState(0)
  const [tableRows, setTableRows] = useState<TranslationRowItem[]>([])
  const [showAddLanguageForm, setShowAddLanguageForm] = useState(false)
  const [renameLanguageIndex, setRenameLanguageIndex] = useState<number | -1>(-1)
  const [showInlineLanguageForm, setShowInlineLanguageForm] = useState(false)
  const [isUpdatingAsset, setIsUpdatingAsset] = useState(false)
  const [isSavingTable, setIsSavingTable] = useState(false)
  const [saveButtonText, setSaveButtonText] = useState(t('Save Changes'))
  const [pagination, setPagination] = useState({ limit: 10, start: 0 })

  const translations = asset.content?.translations || []
  const canAddLanguages = !(translations.length === 1 && translations[0] === null)
  const canEditLanguages = Boolean(
    asset?.content && !hasAssetRestriction(asset.content, LockingRestrictionName.language_edit) && canAddLanguages,
  )

  useEffect(() => {
    if (activeView === 'translations') {
      setTableRows(buildTranslationRows(asset, selectedLangIndex))
      setSaveButtonText(t('Save Changes'))
      setIsSavingTable(false)
      stores.translations.setTranslationTableUnsaved(false)
      setPagination({ limit: 10, start: 0 })
    }
  }, [activeView, asset, selectedLangIndex])

  const tableQuery = useQuery<PaginatedListResponse<TranslationRowItem>>({
    queryKey: [
      'form-languages-manager-table',
      asset.uid,
      selectedLangIndex,
      tableRows,
      pagination.start,
      pagination.limit,
    ],
    queryFn: async () => {
      return {
        status: 200,
        data: {
          count: tableRows.length,
          results: tableRows.slice(pagination.start, pagination.start + pagination.limit),
        },
      }
    },
  })

  async function patchAsset(content: AssetContent) {
    setIsUpdatingAsset(true)
    try {
      const response = await assetsPartialUpdate(asset.uid, {
        name: asset.name,
        content: JSON.stringify(content),
      })

      if (response.status === 200) {
        // TODO: remove casting when parent component starts operating on
        // `Asset` (orval) rather than `AssetResponse` (legacy)
        setAsset(response.data as unknown as AssetResponse)
        return true
      }

      notify.error('failed to update translations')
      return false
    } catch {
      notify.error('failed to update translations')
      return false
    } finally {
      setIsUpdatingAsset(false)
    }
  }

  function requestClose() {
    if (activeView === 'translations' && stores.translations.state.isTranslationTableUnsaved) {
      modals.openConfirmModal({
        title: t('Close Translations Table?'),
        children: t('You will lose all unsaved changes.'),
        labels: { confirm: t('Close'), cancel: t('Cancel') },
        onConfirm: () => {
          stores.translations.setTranslationTableUnsaved(false)
          props.onRequestClose()
        },
      })
      return
    }

    props.onRequestClose()
  }

  useEffect(() => {
    props.registerOnRequestClose?.(requestClose)
  }, [props.registerOnRequestClose, requestClose])

  async function onLanguageChange(lang: LangObject, index: number) {
    let content = cloneDeep(asset.content)
    const langString = getLangString(lang)

    if (!content?.translations) {
      return
    }

    if (index > -1) {
      content.translations[index] = langString || null
    } else {
      content.translations.push(langString || null)
      content = prepareTranslations(content)
    }

    if (index === 0 && content?.settings) {
      content.settings.default_language = langString
    }

    const ok = await patchAsset(content)
    if (ok) {
      setShowAddLanguageForm(false)
      setRenameLanguageIndex(-1)
      setShowInlineLanguageForm(false)
    }
  }

  function openTranslations(index: number) {
    setSelectedLangIndex(index)
    setActiveView('translations')
  }

  function onBackFromTranslations() {
    if (stores.translations.state.isTranslationTableUnsaved) {
      modals.openConfirmModal({
        title: t('Go back?'),
        children: t('You will lose all unsaved changes.'),
        labels: { confirm: t('Confirm'), cancel: t('Cancel') },
        onConfirm: () => {
          stores.translations.setTranslationTableUnsaved(false)
          setActiveView('languages')
        },
      })
      return
    }

    setActiveView('languages')
  }

  async function saveTableChanges() {
    const content = cloneDeep(asset.content)
    if (!content) {
      return
    }

    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i]
      const contentSection = content[row.contentProp]
      if (!contentSection) {
        continue
      }

      const item = contentSection.find(
        (o: Record<string, any>) =>
          (o.name === row.name || o.$autoname === row.name || o.$autovalue === row.name) &&
          o.list_name === row.listName,
      )
      const itemRecord = item as Record<string, Array<string | null> | undefined> | undefined
      const itemProperty = itemRecord?.[row.itemProp]

      if (itemProperty && itemProperty[selectedLangIndex] !== row.value) {
        itemProperty[selectedLangIndex] = row.value
      }
    }

    setIsSavingTable(true)
    setSaveButtonText(t('Saving…'))
    stores.translations.setTranslationTableUnsaved(true)

    const ok = await patchAsset(content)
    if (ok) {
      setSaveButtonText(t('Save Changes'))
      setIsSavingTable(false)
      stores.translations.setTranslationTableUnsaved(false)
    } else {
      setSaveButtonText(t('* Save Changes'))
      setIsSavingTable(false)
      stores.translations.setTranslationTableUnsaved(true)
    }
  }

  async function deleteLanguage(index: number) {
    if (!asset.content) {
      return
    }

    const content = deleteTranslations(asset.content, index)
    if (!content) {
      notify(t('Translation index mismatch. Cannot delete language.'), 'error')
      return
    }

    content.translations?.splice(index, 1)

    modals.openConfirmModal({
      title: t('Delete language?'),
      children: t('Are you sure you want to delete this language? This action is not reversible.'),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await patchAsset(content)
      },
    })
  }

  async function changeDefaultLanguage(index: number) {
    const langString = translations[index]
    modals.openConfirmModal({
      title: t('Change default language?'),
      children: t('Are you sure you would like to set ##lang## as the default language for this form?').replace(
        '##lang##',
        escapeHtml(String(langString)),
      ),
      labels: { confirm: t('Confirm'), cancel: t('Cancel') },
      onConfirm: async () => {
        const content = cloneDeep(asset.content)
        if (content?.settings) {
          content.settings.default_language = langString
          await patchAsset(content)
        }
      },
    })
  }

  function onChangeTranslationCell(absoluteIndex: number, value: string) {
    setTableRows((prev) => {
      const copy = [...prev]
      copy[absoluteIndex].value = value
      return copy
    })
    stores.translations.setTranslationTableUnsaved(true)
    setSaveButtonText(t('* Save Changes'))
  }

  if (!asset?.content) {
    return <LoadingSpinner />
  }

  return (
    <Box
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          requestClose()
        }
      }}
    >
      {activeView === 'languages' ? (
        <LanguagesEditor
          asset={asset}
          translations={translations}
          isUpdatingAsset={isUpdatingAsset}
          showAddLanguageForm={showAddLanguageForm}
          renameLanguageIndex={renameLanguageIndex}
          onToggleAddLanguageForm={setShowAddLanguageForm}
          onToggleRenameLanguage={(index) => {
            setRenameLanguageIndex((prev) => (prev === index ? -1 : index))
          }}
          onChangeDefaultLanguage={changeDefaultLanguage}
          onOpenTranslations={openTranslations}
          onDeleteLanguage={deleteLanguage}
          onLanguageChange={onLanguageChange}
        />
      ) : (
        <TranslationsEditor
          translations={translations}
          selectedLangIndex={selectedLangIndex}
          showInlineLanguageForm={showInlineLanguageForm}
          isUpdatingAsset={isUpdatingAsset}
          isSavingTable={isSavingTable}
          saveButtonText={saveButtonText}
          canEditLanguages={canEditLanguages}
          tableRows={tableRows}
          pagination={pagination}
          setPagination={setPagination}
          queryResult={tableQuery}
          onBack={onBackFromTranslations}
          onSave={saveTableChanges}
          onToggleInlineLanguageForm={() => {
            setShowInlineLanguageForm((prev) => !prev)
          }}
          onLanguageChange={onLanguageChange}
          onChangeCell={onChangeTranslationCell}
        />
      )}
    </Box>
  )
}
