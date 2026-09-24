import { NAME_MAX_LENGTH, update_states, type AssetTypeName, type FormStyleName, type UpdateStatesValue } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import {Box,Group} from '@mantine/core'
import type { Survey } from '../../xlform/src/model.survey'
import Button from '#/components/common/button'
import FormbuilderAssetLabel from './FormbuilderAssetLabel'
import {LOCKING_UI_CLASSNAMES, LockingRestrictionName} from '#/components/locking/lockingConstants'
import cx from 'classnames'
import {hasAssetRestriction, isAssetLockable} from '#/components/locking/lockingUtils'

interface FormbuilderHeaderProps {
  name: string
  asset: AssetResponse | undefined
  desiredAssetType: AssetTypeName | undefined
  asset_updated: UpdateStatesValue
  surveyAppRendered: boolean
  surveyLoadError: string | undefined
  surveySaveFail: boolean
  isNewAsset: boolean | undefined
  settings__style: FormStyleName | undefined
  backRoute: string | undefined
  groupButtonIsActive: boolean
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

  const isAddingGroupsRestricted = (
      props.asset?.content &&
      isAssetLockable(props.asset.asset_type) &&
      hasAssetRestriction(props.asset.content, LockingRestrictionName.group_add)
    )

  return (
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
              isDisabled={toggleCascade === undefined}
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
    )
}
