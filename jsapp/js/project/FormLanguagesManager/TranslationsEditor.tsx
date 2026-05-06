import React from 'react'

import type { UseQueryResult } from '@tanstack/react-query'
import TextareaAutosize from 'react-textarea-autosize'
import type { PaginatedListResponse, Pagination, UniversalTableColumn } from '#/UniversalTable'
import UniversalTable from '#/UniversalTable'
import bem from '#/bem'
import Button from '#/components/common/button'
import LanguageForm from '#/components/modalForms/languageForm'
import type { LangObject } from '#/utils'
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
  onRequestClose: () => void
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
      label: `${props.translations[props.selectedLangIndex] || ''} ${props.selectedLangIndex === 0 ? t('updated text') : t('translation')}`,
      size: 740,
      cellFormatter: (_row, rowIndex) => {
        const absoluteIndex = props.pagination.start + rowIndex
        return (
          <TextareaAutosize
            value={props.tableRows[absoluteIndex]?.value || ''}
            disabled={props.tableRows[absoluteIndex]?.isLabelLocked}
            dir='auto'
            onChange={(evt) => {
              props.onChangeCell(absoluteIndex, evt.target.value)
            }}
          />
        )
      },
    },
  ]

  return (
    <React.Fragment>
      <bem.FormView__cell m='translation-actions'>
        <Button type='secondary' size='m' onClick={props.onBack} label={t('Back')} />
        <Button type='text' size='m' onClick={props.onRequestClose} label={t('Close')} />
      </bem.FormView__cell>

      {props.showInlineLanguageForm && (
        <bem.FormView__cell m='update-language-form'>
          <LanguageForm
            isPending={props.isUpdatingAsset}
            langString={props.translations[props.selectedLangIndex] || null}
            langIndex={props.selectedLangIndex}
            onLanguageChange={props.onLanguageChange}
            existingLanguages={props.translations}
            isDefault={props.selectedLangIndex === 0}
          />
        </bem.FormView__cell>
      )}

      <bem.FormView__cell m='translation-actions'>
        <Button
          type='text'
          size='m'
          onClick={props.onToggleInlineLanguageForm}
          isDisabled={!props.canEditLanguages}
          startIcon={props.showInlineLanguageForm ? 'close' : 'edit'}
          label={t('Edit language')}
        />
      </bem.FormView__cell>

      <div className='translation-table-container'>
        <UniversalTable<TranslationRowItem>
          columns={tableColumns}
          queryResult={props.queryResult}
          pagination={props.pagination}
          setPagination={props.setPagination}
          maxHeight='55vh'
        />
      </div>

      <bem.Modal__footer>
        <Button type='secondary' size='l' onClick={props.onBack} label={t('Back')} />
        <Button
          type='primary'
          size='l'
          onClick={props.onSave}
          isDisabled={props.isSavingTable}
          label={props.saveButtonText}
        />
      </bem.Modal__footer>
    </React.Fragment>
  )
}
