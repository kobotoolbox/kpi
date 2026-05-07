import React from 'react'

import { Box, Group, Stack } from '@mantine/core'
import type { UseQueryResult } from '@tanstack/react-query'
import TextareaAutosize from 'react-textarea-autosize'
import type { PaginatedListResponse, Pagination, UniversalTableColumn } from '#/UniversalTable'
import UniversalTable from '#/UniversalTable'
import ButtonNew from '#/components/common/ButtonNew'
import type { LangObject } from '#/utils'
import LanguageForm from './LanguageForm'
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
  onChangeCell: (absoluteIndex: number, value: string) => void
}

export default function TranslationsEditor(props: TranslationsEditorProps) {
  const tableColumns: Array<UniversalTableColumn<TranslationRowItem>> = [
    {
      key: 'original',
      label: t('Original string'),
      size: 360,
      cellFormatter: (row) => <div className={row.isLabelLocked ? 'rt-td--disabled' : ''}>{row.original}</div>,
    },
    {
      key: 'value',
      label: (
        <Group gap='xs' wrap='nowrap'>
          <span>
            {`${props.translations[props.selectedLangIndex] || ''} ${
              props.selectedLangIndex === 0 ? t('updated text') : t('translation')
            }`}
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
      size: 740,
      cellFormatter: (_row, rowIndex) => {
        const absoluteIndex = props.pagination.start + rowIndex
        return (
          <TextareaAutosize
            value={props.tableRows[absoluteIndex]?.value || ''}
            disabled={props.tableRows[absoluteIndex]?.isLabelLocked}
            dir='auto'
            style={{ width: '100%' }}
            onChange={(evt) => {
              props.onChangeCell(absoluteIndex, evt.target.value)
            }}
          />
        )
      },
    },
  ]

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
        <ButtonNew variant='filled' size='lg' onClick={props.onSave} disabled={props.isSavingTable}>
          {props.saveButtonText}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
