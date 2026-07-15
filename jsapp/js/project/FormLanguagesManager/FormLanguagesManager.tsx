import { Box, Group, Text } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import cloneDeep from 'lodash.clonedeep'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaginatedListResponse } from '#/UniversalTable'
import { assetsPartialUpdate } from '#/api/react-query/manage-projects-and-library-content'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction } from '#/components/locking/lockingUtils'
import type { AssetContent, AssetResponse } from '#/dataInterface'
import { KOBO_MODAL_OVERLAY_PROPS } from '#/theme/kobo/Modal'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import { type LangObject, getLangString, notify } from '#/utils'
import LanguagesEditor from './LanguagesEditor'
import TranslationsEditor from './TranslationsEditor'
import type { TranslationRowItem } from './types'
import { SAVE_BUTTON_LABEL, buildTranslationRows, deleteTranslations, prepareTranslations } from './utils'

export type FormLanguagesManagerView = 'languages' | 'translations'

export interface FormLanguagesManagerProps {
  asset: AssetResponse
  onRequestClose: () => void
  registerOnRequestClose?: (closeHandler: () => void) => void
  onActiveViewChange?: (view: FormLanguagesManagerView) => void
}

export default function FormLanguagesManager(props: FormLanguagesManagerProps) {
  const [asset, setAsset] = useState(props.asset)
  const [activeView, setActiveView] = useState<FormLanguagesManagerView>('languages')
  const [selectedLangIndex, setSelectedLangIndex] = useState(0)
  const [tableRows, setTableRows] = useState<TranslationRowItem[]>([])
  const [showAddLanguageForm, setShowAddLanguageForm] = useState(false)
  const [renameLanguageIndex, setRenameLanguageIndex] = useState<number | -1>(-1)
  const [showInlineLanguageForm, setShowInlineLanguageForm] = useState(false)
  const [isUpdatingAsset, setIsUpdatingAsset] = useState(false)
  const [isSavingTable, setIsSavingTable] = useState(false)
  const [saveButtonText, setSaveButtonText] = useState(SAVE_BUTTON_LABEL.idle)
  const [pagination, setPagination] = useState({ limit: 10, start: 0 })
  const [pendingDeleteLanguageIndex, setPendingDeleteLanguageIndex] = useState<number | null>(null)
  const [pendingDefaultLanguageIndex, setPendingDefaultLanguageIndex] = useState<number | null>(null)
  const [pendingUnsavedConfirm, setPendingUnsavedConfirm] = useState<'close' | 'back' | null>(null)
  const [isTranslationTableUnsaved, setIsTranslationTableUnsaved] = useState(false)
  // Track if any cell has been edited without committing to state (to avoid first-keystroke parent re-render)
  const tableHasUnsavedEditsRef = useRef(false)

  const translations = asset.content?.translations || []
  const canAddLanguages = !(translations.length === 1 && translations[0] === null)
  const canEditLanguages = Boolean(
    asset?.content && !hasAssetRestriction(asset.content, LockingRestrictionName.language_edit) && canAddLanguages,
  )

  useEffect(() => {
    if (activeView === 'translations') {
      setTableRows(buildTranslationRows(asset, selectedLangIndex))
      setSaveButtonText(SAVE_BUTTON_LABEL.idle)
      setIsSavingTable(false)
      setIsTranslationTableUnsaved(false)
      tableHasUnsavedEditsRef.current = false
      setPagination({ limit: 10, start: 0 })
    }
  }, [activeView, asset, selectedLangIndex])

  useEffect(() => {
    props.onActiveViewChange?.(activeView)
  }, [activeView, props.onActiveViewChange])

  const queryClient = useQueryClient()

  const tableQueryKey = useMemo(
    () => ['form-languages-manager-table', asset.uid, selectedLangIndex, pagination.start, pagination.limit] as const,
    [asset.uid, selectedLangIndex, pagination.start, pagination.limit],
  )

  // Push in-memory updates synchronously so the table never goes through a
  // loading/null state on cell edits or pagination changes.
  useEffect(() => {
    queryClient.setQueryData(tableQueryKey, {
      status: 200,
      data: {
        count: tableRows.length,
        results: tableRows.slice(pagination.start, pagination.start + pagination.limit),
      },
    })
  }, [queryClient, tableQueryKey, tableRows, pagination.start, pagination.limit])

  // tableRows is intentionally excluded from the queryKey: updates are pushed
  // synchronously via setQueryData above, so the queryFn only runs on
  // initial mount to seed the cache.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps -- tableRows is intentionally excluded
  const tableQuery = useQuery<PaginatedListResponse<TranslationRowItem>>({
    queryKey: tableQueryKey,
    queryFn: async () => {
      return {
        status: 200,
        data: {
          count: tableRows.length,
          results: tableRows.slice(pagination.start, pagination.start + pagination.limit),
        },
      }
    },
    enabled: false,
    initialData: {
      status: 200,
      data: {
        count: tableRows.length,
        results: tableRows.slice(pagination.start, pagination.start + pagination.limit),
      },
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

      notify.error(t('Failed to update translations'))
      return false
    } catch {
      notify.error(t('Failed to update translations'))
      return false
    } finally {
      setIsUpdatingAsset(false)
    }
  }

  const requestClose = useCallback(() => {
    // Check both state and ref: ref catches unsaved edits before they commit to state,
    // state catches them after blur.
    if (activeView === 'translations' && (isTranslationTableUnsaved || tableHasUnsavedEditsRef.current)) {
      setPendingUnsavedConfirm('close')
      return
    }

    props.onRequestClose()
  }, [activeView, isTranslationTableUnsaved, props.onRequestClose])

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
    if (isTranslationTableUnsaved || tableHasUnsavedEditsRef.current) {
      setPendingUnsavedConfirm('back')
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
    setSaveButtonText(SAVE_BUTTON_LABEL.saving)

    const ok = await patchAsset(content)
    if (ok) {
      setSaveButtonText(SAVE_BUTTON_LABEL.idle)
      setIsSavingTable(false)
      setIsTranslationTableUnsaved(false)
      tableHasUnsavedEditsRef.current = false
    } else {
      setSaveButtonText(SAVE_BUTTON_LABEL.dirty)
      setIsSavingTable(false)
      setIsTranslationTableUnsaved(true)
    }
  }

  async function deleteLanguage(index: number) {
    setPendingDeleteLanguageIndex(index)
  }

  async function confirmDeleteLanguage() {
    if (pendingDeleteLanguageIndex === null || !asset.content) {
      return
    }

    const content = deleteTranslations(asset.content, pendingDeleteLanguageIndex)
    if (!content) {
      notify(t('Translation index mismatch. Cannot delete language.'), 'error')
      setPendingDeleteLanguageIndex(null)
      return
    }

    content.translations?.splice(pendingDeleteLanguageIndex, 1)

    const ok = await patchAsset(content)
    if (ok) {
      setPendingDeleteLanguageIndex(null)
      // Indices to the right of the deleted one have shifted, so any open
      // rename form would now be pointing at a different language. Close it
      // to avoid submitting stale data against the wrong index.
      setRenameLanguageIndex(-1)
    }
  }

  function changeDefaultLanguage(index: number) {
    setPendingDefaultLanguageIndex(index)
  }

  async function confirmChangeDefaultLanguage() {
    if (pendingDefaultLanguageIndex === null) {
      return
    }

    const langString = translations[pendingDefaultLanguageIndex]
    if (langString === null) {
      notify.error(t('Cannot set an unnamed language as the default language.'))
      setPendingDefaultLanguageIndex(null)
      return
    }

    const content = cloneDeep(asset.content)
    if (content?.settings) {
      content.settings.default_language = langString
      const ok = await patchAsset(content)
      if (ok) {
        setPendingDefaultLanguageIndex(null)
      }
    } else {
      setPendingDefaultLanguageIndex(null)
    }
  }

  const onStartEditingCell = useCallback(() => {
    // Only flip the ref here — never call a setState. Triggering a parent
    // re-render mid-keystroke (the first keystroke in particular) makes the
    // Mantine autosize Textarea lose focus, so the asterisk in the save button
    // is handled locally inside TranslationsEditor instead. The close/back
    // guards read this ref to catch unsaved edits before onBlur commits them.
    tableHasUnsavedEditsRef.current = true
  }, [])

  const onChangeTranslationCell = useCallback((absoluteIndex: number, value: string) => {
    // Commit the edited value only after blur, when the textarea is no longer
    // focused and a parent render can safely happen. This is where we update the
    // state to show the * in the save button and fully mark the table as dirty.
    setTableRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== absoluteIndex) {
          return row
        }
        return {
          ...row,
          value,
        }
      }),
    )
    tableHasUnsavedEditsRef.current = true
    setIsTranslationTableUnsaved(true)
    setSaveButtonText(SAVE_BUTTON_LABEL.dirty)
  }, [])

  const toggleInlineLanguageForm = useCallback(() => {
    setShowInlineLanguageForm((prev) => !prev)
  }, [])

  if (!asset?.content) {
    return <LoadingSpinner />
  }

  return (
    <Box
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          if (pendingDeleteLanguageIndex !== null) {
            setPendingDeleteLanguageIndex(null)
            return
          }
          if (pendingDefaultLanguageIndex !== null) {
            setPendingDefaultLanguageIndex(null)
            return
          }
          if (pendingUnsavedConfirm !== null) {
            setPendingUnsavedConfirm(null)
            return
          }
          requestClose()
        }
      }}
    >
      <ModalNew
        opened={pendingUnsavedConfirm !== null}
        onClose={() => {
          setPendingUnsavedConfirm(null)
        }}
        title={pendingUnsavedConfirm === 'close' ? t('Close Translations Table?') : t('Go back?')}
        size='sm'
        centered
        withOverlay={true}
        closeOnEscape={false}
        zIndex={KOBO_Z_INDEX.nestedModal}
        overlayProps={{
          ...KOBO_MODAL_OVERLAY_PROPS,
          zIndex: KOBO_Z_INDEX.nestedModalOverlay,
        }}
      >
        <Text>{t('You will lose all unsaved changes.')}</Text>

        <Group justify='flex-end' mt='md'>
          <ButtonNew
            variant='light'
            onClick={() => {
              setPendingUnsavedConfirm(null)
            }}
          >
            {t('Cancel')}
          </ButtonNew>

          <ButtonNew
            variant='filled'
            onClick={() => {
              const action = pendingUnsavedConfirm
              setPendingUnsavedConfirm(null)
              setIsTranslationTableUnsaved(false)
              tableHasUnsavedEditsRef.current = false

              if (action === 'close') {
                props.onRequestClose()
              } else if (action === 'back') {
                setActiveView('languages')
              }
            }}
          >
            {pendingUnsavedConfirm === 'close' ? t('Close') : t('Confirm')}
          </ButtonNew>
        </Group>
      </ModalNew>

      <ModalNew
        opened={pendingDeleteLanguageIndex !== null}
        onClose={() => {
          setPendingDeleteLanguageIndex(null)
        }}
        title={t('Delete language?')}
        size='sm'
        centered
        withOverlay={true}
        closeOnEscape={false}
        zIndex={KOBO_Z_INDEX.nestedModal}
        overlayProps={{
          ...KOBO_MODAL_OVERLAY_PROPS,
          zIndex: KOBO_Z_INDEX.nestedModalOverlay,
        }}
      >
        <Text>{t('Are you sure you want to delete this language? This action is not reversible.')}</Text>

        <Group justify='flex-end' mt='md'>
          <ButtonNew
            variant='light'
            onClick={() => {
              setPendingDeleteLanguageIndex(null)
            }}
          >
            {t('Cancel')}
          </ButtonNew>

          <ButtonNew variant='danger' loading={isUpdatingAsset} onClick={confirmDeleteLanguage}>
            {t('Delete')}
          </ButtonNew>
        </Group>
      </ModalNew>

      <ModalNew
        opened={pendingDefaultLanguageIndex !== null}
        onClose={() => {
          setPendingDefaultLanguageIndex(null)
        }}
        title={t('Change default language?')}
        size='sm'
        centered
        withOverlay={true}
        closeOnEscape={false}
        zIndex={KOBO_Z_INDEX.nestedModal}
        overlayProps={{
          ...KOBO_MODAL_OVERLAY_PROPS,
          zIndex: KOBO_Z_INDEX.nestedModalOverlay,
        }}
      >
        <Text>
          {t('Are you sure you would like to set ##lang## as the default language for this form?').replace(
            '##lang##',
            (pendingDefaultLanguageIndex !== null ? translations[pendingDefaultLanguageIndex] : null) ??
              t('Unnamed language'),
          )}
        </Text>

        <Group justify='flex-end' mt='md'>
          <ButtonNew
            variant='light'
            onClick={() => {
              setPendingDefaultLanguageIndex(null)
            }}
          >
            {t('Cancel')}
          </ButtonNew>

          <ButtonNew variant='filled' loading={isUpdatingAsset} onClick={confirmChangeDefaultLanguage}>
            {t('Confirm')}
          </ButtonNew>
        </Group>
      </ModalNew>

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
          onToggleInlineLanguageForm={toggleInlineLanguageForm}
          onLanguageChange={onLanguageChange}
          onStartEditing={onStartEditingCell}
          onChangeCell={onChangeTranslationCell}
        />
      )}
    </Box>
  )
}
