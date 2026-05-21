import React, { useCallback, useMemo, useRef } from 'react'

import { Box, Group, Stack } from '@mantine/core'
import type { UseQueryResult } from '@tanstack/react-query'
import type { PaginatedListResponse, Pagination, UniversalTableColumn } from '#/UniversalTable'
import UniversalTable from '#/UniversalTable'
import ButtonNew from '#/components/common/ButtonNew'
import type { LangObject } from '#/utils'
import LanguageForm from './LanguageForm'
import SaveChangesButton from './SaveChangesButton'
import TranslationsEditorCell from './TranslationsEditorCell'
import type { TranslationRowItem } from './types'

interface TranslationsEditorProps {
  translations: Array<string | null>
  selectedLangIndex: number
  showInlineLanguageForm: boolean
  isUpdatingAsset: boolean
  isSavingTable: boolean
  saveButtonText: string
  canEditLanguages: boolean
  tableRows: TranslationRowItem[]
  pagination: Pagination
  setPagination: (pagination: Pagination) => void
  queryResult: UseQueryResult<PaginatedListResponse<TranslationRowItem>, Error>
  onBack: () => void
  onSave: () => void | Promise<void>
  onToggleInlineLanguageForm: () => void
  onLanguageChange: (lang: LangObject, index: number) => void | Promise<void>
  onStartEditing: () => void
  onChangeCell: (absoluteIndex: number, value: string) => void
}

export default function TranslationsEditor(props: TranslationsEditorProps) {
  const selectedLanguageLabel = props.translations[props.selectedLangIndex] || ''

  // Stable ref that SaveChangesButton hooks into so we can flip its local dirty
  // state without re-rendering TranslationsEditor (and therefore without
  // tearing down the active textarea).
  const markDirtyRef = useRef<() => void>(() => {})

  const handleStartEditing = useCallback(() => {
    markDirtyRef.current()
    props.onStartEditing()
  }, [props.onStartEditing])

  const tableColumns: Array<UniversalTableColumn<TranslationRowItem>> = useMemo(
    () => [
      {
        key: 'original',
        label: t('Original string'),
        size: 100,
        grow: true,
        cellFormatter: (row) => <div className={row.isLabelLocked ? 'rt-td--disabled' : ''}>{row.original}</div>,
      },
      {
        key: 'value',
        label: (
          <Group gap='xs' wrap='nowrap'>
            <span>
              {`${selectedLanguageLabel} ${props.selectedLangIndex === 0 ? t('updated text') : t('translation')}`}
            </span>
            <ButtonNew
              variant='transparent'
              size='sm'
              onClick={props.onToggleInlineLanguageForm}
              disabled={!props.canEditLanguages || props.showInlineLanguageForm}
              leftIcon='edit'
            >
              {t('Edit language')}
            </ButtonNew>
          </Group>
        ),
        size: 200,
        grow: true,
        cellFormatter: (row, rowIndex) => {
          const absoluteIndex = props.pagination.start + rowIndex
          return (
            // Give the cell a stable identity so React keeps the textarea instance
            // mounted while its draft value changes locally.
            <TranslationsEditorCell
              key={`${row.name}-${row.listName || ''}-${absoluteIndex}`}
              initialValue={row.value || ''}
              disabled={row.isLabelLocked}
              absoluteIndex={absoluteIndex}
              onStartEditing={handleStartEditing}
              onChangeCell={props.onChangeCell}
            />
          )
        },
      },
    ],
    [
      props.canEditLanguages,
      props.onChangeCell,
      handleStartEditing,
      props.onToggleInlineLanguageForm,
      props.pagination.start,
      props.selectedLangIndex,
      selectedLanguageLabel,
      props.showInlineLanguageForm,
    ],
  )

  return (
    <Stack gap='md'>
      {props.showInlineLanguageForm && (
        <Box>
          <LanguageForm
            isPending={props.isUpdatingAsset}
            langString={props.translations[props.selectedLangIndex] || null}
            langIndex={props.selectedLangIndex}
            onLanguageChange={props.onLanguageChange}
            existingLanguages={props.translations}
            isDefault={props.selectedLangIndex === 0}
            onCancel={props.onToggleInlineLanguageForm}
          />
        </Box>
      )}

      <Box>
        <UniversalTable<TranslationRowItem>
          columns={tableColumns}
          queryResult={props.queryResult}
          pagination={props.pagination}
          setPagination={props.setPagination}
          maxHeight='55vh'
        />
      </Box>

      <Group justify='flex-end'>
        <ButtonNew variant='light' size='lg' onClick={props.onBack}>
          {t('Back')}
        </ButtonNew>
        <SaveChangesButton
          saveButtonText={props.saveButtonText}
          isSavingTable={props.isSavingTable}
          onSave={props.onSave}
          markDirtyRef={markDirtyRef}
        />
      </Group>
    </Stack>
  )
}
