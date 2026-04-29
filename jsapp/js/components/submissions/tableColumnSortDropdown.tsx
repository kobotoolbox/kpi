import './tableColumnSortDropdown.scss'

import React from 'react'
import { useState } from 'react'

import classNames from 'classnames'
import Menu from '#/components/common/Menu'
import Icon from '#/components/common/icon'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import { SortValues } from '#/components/submissions/tableConstants'
import { type AnyRowTypeName, QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'

const CLEAR_BUTTON_CLASS_NAME = 'table-column-sort-dropdown-clear'

interface TableColumnSortDropdownProps {
  asset: AssetResponse
  /** one of table columns */
  fieldId: string
  questionType?: AnyRowTypeName
  sortValue: SortValues | null
  onSortChange: (fieldId: string, sortValue: SortValues | null) => void
  onHide: (fieldId: string) => void
  isFieldFrozen: boolean
  onFrozenChange: (fieldId: string, isFrozen: boolean) => void
  onTranscribeSelectedAudioFiles?: (fieldId: string) => void
  onTranslateSelectedTranscriptions?: (fieldId: string) => void
  isBulkProcessingDisabled?: boolean
  /**
   * To be put inside trigger, before the predefined content. Please note that
   * the trigger as a whole is clickable, so this additional content would need
   * stopPropagation to be clickable.
   */
  additionalTriggerContent?: React.ReactNode
}

/**
 * A dropdown used in table header to sort and manage columns.
 */
export default function TableColumnSortDropdown(props: TableColumnSortDropdownProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isBulkProcessingFeatureEnabled = useFeatureFlag(FeatureFlag.bulkProcessingEnabled)

  const isAudioQuestionColumn = props.questionType === QuestionTypeName.audio
  const isTranscriptColumn = getSupplementalPathParts(props.fieldId).type === 'transcript'
  const canTranscribeSelectedAudioFiles =
    isBulkProcessingFeatureEnabled && isAudioQuestionColumn && Boolean(props.onTranscribeSelectedAudioFiles)
  const canTranslateSelectedTranscriptions =
    isBulkProcessingFeatureEnabled && isTranscriptColumn && Boolean(props.onTranslateSelectedTranscriptions)
  const shouldRenderBulkProcessingButtons = canTranscribeSelectedAudioFiles || canTranslateSelectedTranscriptions

  function renderTrigger() {
    let sortIconName: 'sort-ascending' | 'sort-descending' | null = null
    if (props.sortValue && props.sortValue === SortValues.ASCENDING) {
      sortIconName = 'sort-ascending'
    }
    if (props.sortValue && props.sortValue === SortValues.DESCENDING) {
      sortIconName = 'sort-descending'
    }

    return (
      <div className='table-column-sort-dropdown-trigger' dir='auto'>
        {props.additionalTriggerContent}
        {sortIconName && <Icon name={sortIconName} size='inherit' />}
        {isMenuOpen && <Icon name='caret-up' size='inherit' />}
        {!isMenuOpen && <Icon name='caret-down' size='inherit' />}
      </div>
    )
  }

  function clearSort() {
    props.onSortChange(props.fieldId, null)
  }

  function changeSort(sortValue: SortValues, evt: React.MouseEvent<HTMLButtonElement>) {
    const eventTarget = evt.target as HTMLButtonElement

    // When clicking on clear icon button, we need to avoid triggering also the
    // change sort button. We can't use `stopPropagation` on `clearSort` as it
    // breaks `onMenuClick` functionality.
    if (eventTarget?.classList?.contains(CLEAR_BUTTON_CLASS_NAME)) {
      return
    }
    props.onSortChange(props.fieldId, sortValue)
  }

  function hideField() {
    props.onHide(props.fieldId)
  }

  function changeFieldFrozen(isFrozen: boolean) {
    props.onFrozenChange(props.fieldId, isFrozen)
  }

  function transcribeSelectedAudioFiles() {
    props.onTranscribeSelectedAudioFiles?.(props.fieldId)
  }

  function translateSelectedTranscriptions() {
    props.onTranslateSelectedTranscriptions?.(props.fieldId)
  }

  function renderSortButton(buttonSortValue: SortValues) {
    return (
      <Menu.Item
        className={classNames({
          'sort-dropdown-menu-button': true,
          'sort-dropdown-menu-button--active': props.sortValue === buttonSortValue,
        })}
        onClick={(evt) => {
          changeSort(buttonSortValue, evt)
        }}
        leftSection={
          buttonSortValue === SortValues.ASCENDING ? (
            <Icon name='sort-ascending' size='inherit' />
          ) : (
            <Icon name='sort-descending' size='inherit' />
          )
        }
        rightSection={
          props.sortValue === buttonSortValue ? (
            <span onClick={clearSort}>
              <Icon name='close' size='inherit' className={classNames(CLEAR_BUTTON_CLASS_NAME)} />
            </span>
          ) : null
        }
      >
        {buttonSortValue === SortValues.ASCENDING && t('Sort A→Z')}
        {buttonSortValue === SortValues.DESCENDING && t('Sort Z→A')}
      </Menu.Item>
    )
  }

  return (
    <div className='table-column-sort-dropdown'>
      <Menu closeOnItemClick offset={0} onOpen={() => setIsMenuOpen(true)} onClose={() => setIsMenuOpen(false)}>
        <Menu.Target>
          <button type='button' className='table-column-sort-dropdown-trigger-button'>
            {renderTrigger()}
          </button>
        </Menu.Target>

        <Menu.Dropdown>
          {renderSortButton(SortValues.ASCENDING)}
          {renderSortButton(SortValues.DESCENDING)}

          {shouldRenderBulkProcessingButtons && (
            <>
              <Menu.Divider />

              {canTranscribeSelectedAudioFiles && (
                <Menu.Item
                  className='sort-dropdown-menu-button'
                  disabled={props.isBulkProcessingDisabled}
                  onClick={transcribeSelectedAudioFiles}
                  leftSection={<Icon name='qt-audio' size='inherit' />}
                >
                  {t('Transcribe selected audio files')}
                </Menu.Item>
              )}

              {canTranslateSelectedTranscriptions && (
                <Menu.Item
                  className='sort-dropdown-menu-button'
                  disabled={props.isBulkProcessingDisabled}
                  onClick={translateSelectedTranscriptions}
                  leftSection={<Icon name='transcripts' size='inherit' />}
                >
                  {t('Translate selected transcriptions')}
                </Menu.Item>
              )}
            </>
          )}

          {userCan(PERMISSIONS_CODENAMES.change_asset, props.asset) && (
            <>
              <Menu.Divider />

              <Menu.Item
                className='sort-dropdown-menu-button'
                onClick={hideField}
                leftSection={<Icon name='hide' size='inherit' />}
              >
                {t('Hide field')}
              </Menu.Item>

              <Menu.Item
                className='sort-dropdown-menu-button'
                onClick={() => {
                  changeFieldFrozen(!props.isFieldFrozen)
                }}
                leftSection={
                  props.isFieldFrozen ? <Icon name='unfreeze' size='inherit' /> : <Icon name='freeze' size='inherit' />
                }
              >
                {props.isFieldFrozen && t('Unfreeze field')}
                {!props.isFieldFrozen && t('Freeze field')}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </div>
  )
}
