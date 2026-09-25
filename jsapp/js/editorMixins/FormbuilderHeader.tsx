import { Anchor, Box, Group, Text, Textarea } from '@mantine/core'
import cx from 'classnames'
import { useRef, useState } from 'react'
import ModalNew from '#/components/common/ModalNew'
import Button from '#/components/common/button'
import { LOCKING_UI_CLASSNAMES, LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction, isAssetLockable } from '#/components/locking/lockingUtils'
import { type AssetTypeName, NAME_MAX_LENGTH, type UpdateStatesValue, update_states } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import dkobo_xlform from '../../xlform/src/_xlform.init'
import type { Survey } from '../../xlform/src/model.survey'
import FormbuilderAssetLabel from './FormbuilderAssetLabel'

interface CascadeMessage {
  msgType: 'ready' | 'warning'
  addCascadeMessage?: string
  message?: string
}

interface FormbuilderHeaderProps {
  name: string
  asset: AssetResponse | undefined
  desiredAssetType: AssetTypeName | undefined
  asset_updated: UpdateStatesValue
  surveyAppRendered: boolean
  surveyLoadError: string | undefined
  surveySaveFail: boolean
  isNewAsset: boolean | undefined
  groupButtonIsActive: boolean | undefined
  asideLibrarySearchVisible: boolean
  asideLayoutSettingsVisible: boolean
  hasMetadataAndDetails: boolean
  surveyHasRows: boolean
  surveyHasSelectQuestion: boolean
  onNavigateToList: () => void
  onNavigateToAsset: () => void
  // These callbacks are used as props as a wrapper around `app` access
  onSave: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onPreview: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onNameChange: (evt: React.ChangeEvent<HTMLInputElement>) => void
  onShowAll: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onGroupQuestions: () => void
  onToggleAsideLibrarySearch: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onToggleAsideLayoutSettings: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onGetCascadeInsertIndex: () => number
  onInsertCascade: (survey: Survey, rowIndex: number | undefined) => void
}

const CHOICE_LIST_SUPPORT_URL = 'cascading_select.html'

export default function FormbuilderHeader(props: FormbuilderHeaderProps) {
  // If survey has no questions preview is disabled
  const previewDisabled = !props.surveyHasRows
  const groupable = !!props.groupButtonIsActive
  const showAllAvailable = !!props.surveyHasSelectQuestion
  const saveButtonText = props.isNewAsset
    ? t('create')
    : props.surveySaveFail
      ? `${t('save')} (${t('retry')}) `
      : t('save')

  const needsSave = props.asset_updated === update_states.UNSAVED_CHANGES

  const isAddingGroupsRestricted =
    props.asset?.content &&
    isAssetLockable(props.asset.asset_type) &&
    hasAssetRestriction(props.asset.content, LockingRestrictionName.group_add)

  const [showCascadePopup, setShowCascadePopup] = useState(false)
  const [cascadeMessage, setCascadeMessage] = useState<CascadeMessage | undefined>(undefined)
  const [cascadeReady, setCascadeReady] = useState(false)
  const [cascadeReadySurvey, setCascadeReadySurvey] = useState<Survey | undefined>(undefined)
  const [cascadeTextareaValue, setCascadeTextareaValue] = useState('')
  const [cascadeLastSelectedRowIndex, setCascadeLastSelectedRowIndex] = useState<number | undefined>(undefined)
  const cascadeRef = useRef<HTMLTextAreaElement>(null)

  const toggleCascade = () => {
    setShowCascadePopup((prev) => !prev)
    setCascadeTextareaValue('')
    setCascadeLastSelectedRowIndex(props.onGetCascadeInsertIndex())
  }

  const cancelCascade = () => {
    setCascadeReady(false)
    setCascadeReadySurvey(undefined)
    setCascadeTextareaValue('')
    setShowCascadePopup(false)
  }

  const cascadePopupChange = () => {
    const el = cascadeRef.current
    if (!el) return
    const value = (el as HTMLTextAreaElement).value
    setCascadeTextareaValue(value)
    try {
      const inp = dkobo_xlform.model.utils.split_paste(value)
      const tmpSurvey = new dkobo_xlform.model.Survey({ survey: [], choices: inp })
      if (tmpSurvey.choices.length === 0) throw new Error(t('Paste your formatted table from excel in the box below.'))
      tmpSurvey.choices.at(0).create_corresponding_rows()
      const rowCount = tmpSurvey.rows.length
      if (rowCount === 0) throw new Error(t('Paste your formatted table from excel in the box below.'))
      setCascadeReady(true)
      setCascadeReadySurvey(tmpSurvey)
      setCascadeMessage({
        msgType: 'ready',
        addCascadeMessage: t('add cascade with # questions').replace('#', rowCount.toString()),
      })
    } catch (err) {
      setCascadeReady(false)
      setCascadeMessage({ msgType: 'warning', message: (err as { message?: string }).message })
    }
  }

  return (
    <>
      <Box className='form-builder-header'>
        <Group className='form-builder-header__row form-builder-header__row--primary' wrap='nowrap' gap={20}>
          <Box
            className='form-builder-header__cell form-builder-header__cell--logo left-tooltip'
            data-tip={t('Return to list')}
            tabIndex={0}
            onClick={props.onNavigateToList}
          >
            <i className='k-icon k-icon-kobo' />
          </Box>

          <Box className='form-builder-header__cell form-builder-header__cell--name'>
            <Box className='form-modal__item'>
              <FormbuilderAssetLabel asset={props.asset} desiredAssetType={props.desiredAssetType} />
              <input
                type='text'
                maxLength={NAME_MAX_LENGTH}
                onChange={props.onNameChange}
                value={props.name}
                title={props.name}
                id='nameField'
                dir='auto'
              />
            </Box>
          </Box>

          <Group className='form-builder-header__cell form-builder-header__cell--buttonsTopRight'>
            <Button
              type='primary'
              size='l'
              isPending={props.asset_updated === update_states.PENDING_UPDATE}
              isDisabled={!props.surveyAppRendered || !!props.surveyLoadError}
              onClick={props.onSave}
              isUpperCase
              label={
                <>
                  {saveButtonText}
                  {props.asset_updated === update_states.SAVE_FAILED || (needsSave && <>&nbsp;*</>)}
                </>
              }
            />

            <Button type='text' size='l' onClick={props.onNavigateToAsset} startIcon='close' />
          </Group>
        </Group>

        <Group className='form-builder-header__row form-builder-header__row--secondary' wrap='nowrap'>
          <Group className='form-builder-header__cell form-builder-header__cell--toolsButtons'>
            <Button
              type='text'
              size='m'
              isDisabled={previewDisabled}
              onClick={props.onPreview}
              tooltip={t('Preview form')}
              tooltipPosition='left'
              startIcon='view'
            />

            <Button
              type='text'
              size='m'
              isDisabled={!showAllAvailable}
              onClick={props.onShowAll}
              tooltip={t('Expand / collapse questions')}
              tooltipPosition='left'
              startIcon='view-all'
            />

            <Button
              type='text'
              size='m'
              isDisabled={!groupable}
              onClick={props.onGroupQuestions}
              tooltip={
                groupable
                  ? t('Create group with selected questions')
                  : t('Grouping disabled. Please select at least one question.')
              }
              tooltipPosition='left'
              startIcon='group'
              className={cx({
                [LOCKING_UI_CLASSNAMES.DISABLED]: isAddingGroupsRestricted,
              })}
            />

            <Button
              type='text'
              size='m'
              isDisabled={!props.surveyAppRendered}
              onClick={toggleCascade}
              tooltip={t('Insert cascading select')}
              tooltipPosition='left'
              startIcon='cascading'
              className={cx({
                [LOCKING_UI_CLASSNAMES.DISABLED]: isAddingGroupsRestricted,
              })}
            />
          </Group>

          <Box className='form-builder-header__cell form-builder-header__cell--verticalRule' />

          <Box className='form-builder-header__cell form-builder-header__cell--spacer' />

          <Box className='form-builder-header__cell form-builder-header__cell--verticalRule' />

          <Box className='form-builder-header__cell'>
            <Button
              type='text'
              size='m'
              onClick={props.onToggleAsideLibrarySearch}
              tooltip={t('Add an item from the library')}
              tooltipPosition='left'
              startIcon={props.asideLibrarySearchVisible ? 'close' : 'library'}
              label={t('Add from Library')}
            />
          </Box>

          <Box className='form-builder-header__cell form-builder-header__cell--verticalRule' />

          <Box className='form-builder-header__cell'>
            <Button
              type='text'
              size='m'
              onClick={props.onToggleAsideLayoutSettings}
              tooltip={props.hasMetadataAndDetails ? t('Change form layout and settings') : t('Change form layout')}
              tooltipPosition='left'
              startIcon={props.asideLayoutSettingsVisible ? 'close' : 'settings'}
              label={props.hasMetadataAndDetails ? t('Layout & Settings') : t('Layout')}
            />
          </Box>
        </Group>
      </Box>

      <ModalNew opened={showCascadePopup} onClose={cancelCascade} title={t('Import Cascading Select Questions')}>
        <Box>
          {cascadeMessage ? (
            <Text c={cascadeMessage.msgType === 'warning' ? 'red' : 'teal'}>{cascadeMessage.message}</Text>
          ) : (
            <Text>{t('Paste your formatted table from excel in the box below.')}</Text>
          )}
          {cascadeReady && <Text c='teal'>{t('OK')}</Text>}
          <Textarea
            ref={cascadeRef}
            onChange={cascadePopupChange}
            value={cascadeTextareaValue}
            mt='md'
            mb='md'
            rows={8}
          />
          {envStore.isReady && envStore.data.support_url && (
            <Group justify='flex-end' className='cascade-help right-tooltip'>
              <Anchor
                href={envStore.data.support_url + CHOICE_LIST_SUPPORT_URL}
                target='_blank'
                data-tip={t('Learn more about importing cascading lists from Excel')}
              >
                <i className='k-icon k-icon-help' />
              </Anchor>
            </Group>
          )}
          <Group justify='flex-end' mt='sm'>
            <Button
              type='primary'
              size='l'
              isDisabled={!cascadeReady}
              onClick={() => {
                if (cascadeReadySurvey) {
                  props.onInsertCascade(cascadeReadySurvey, cascadeLastSelectedRowIndex)
                  cancelCascade()
                }
              }}
              label={t('DONE')}
            />
          </Group>
        </Box>
      </ModalNew>
    </>
  )
}
