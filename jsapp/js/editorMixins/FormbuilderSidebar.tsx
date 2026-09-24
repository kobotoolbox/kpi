import { Box, Text } from '@mantine/core'
import cx from 'classnames'
import Select from '#/components/common/Select'
import { LOCKING_UI_CLASSNAMES, LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasAssetRestriction, isAssetLockable } from '#/components/locking/lockingUtils'
import MetadataEditor from '#/components/metadataEditor'
import { AVAILABLE_FORM_STYLES, type AssetTypeName, type FormStyleName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { ROUTES } from '#/router/routerConstants'
import type { Survey } from '../../xlform/src/model.survey'
import AssetNavigator from './AssetNavigator'

interface FormbuilderSidebarProps {
  asideLayoutSettingsVisible: boolean
  asideLibrarySearchVisible: boolean
  settings__style: FormStyleName | undefined
  backRoute: string | undefined
  onStyleChange: (val: string | null) => void
  onMetadataEditorChange: () => void
  survey: Survey | undefined
  asset: AssetResponse | undefined
  desiredAssetType: AssetTypeName | undefined
  hasMetadataAndDetails: boolean
}

const WEBFORM_STYLES_SUPPORT_URL = 'alternative_enketo.html'

function getStyleSelectVal(optionVal?: FormStyleName) {
  // Styles we no longer offer leave the dropdown empty instead of adding an
  // option that couldn't be picked again anyway.
  return AVAILABLE_FORM_STYLES.find((option) => option.value === optionVal)?.value ?? null
}

export default function FormbuilderSidebar(props: FormbuilderSidebarProps) {
  const visible = props.asideLayoutSettingsVisible || props.asideLibrarySearchVisible
  const hasSettings = props.backRoute === ROUTES.FORMS
  const isChangingAppearanceRestricted =
    props.asset?.content &&
    isAssetLockable(props.asset.asset_type) &&
    hasAssetRestriction(props.asset.content, LockingRestrictionName.form_appearance)
  const isChangingMetaQuestionsRestricted =
    props.asset?.content &&
    isAssetLockable(props.asset.asset_type) &&
    hasAssetRestriction(props.asset.content, LockingRestrictionName.form_meta_edit)
  const isAddingQuestionsRestricted =
    props.asset?.content &&
    isAssetLockable(props.asset.asset_type) &&
    hasAssetRestriction(props.asset.content, LockingRestrictionName.question_add)

  return (
    <Box className={cx('form-builder-aside', visible && 'form-builder-aside--visible')}>
      {props.asideLayoutSettingsVisible && (
        <Box className='form-builder-aside__content'>
          <Box className='form-builder-aside__row'>
            <Text className='form-builder-aside__header'>
              {t('Form style')}

              {envStore.isReady && envStore.data.support_url && (
                <a
                  href={envStore.data.support_url + WEBFORM_STYLES_SUPPORT_URL}
                  target='_blank'
                  data-tip={t('Read more about form styles')}
                >
                  <i className='k-icon k-icon-help' />
                </a>
              )}
            </Text>

            <Select
              id='webform-style'
              name='webform-style'
              label={
                hasSettings
                  ? t('Select the form style that you would like to use. This will only affect web forms.')
                  : t(
                      'Select the form style. This will only affect the Enketo preview, and it will not be saved with the question or block.',
                    )
              }
              value={getStyleSelectVal(props.settings__style)}
              onChange={props.onStyleChange}
              placeholder={AVAILABLE_FORM_STYLES[0].label}
              data={AVAILABLE_FORM_STYLES}
              // To be type safe with undefined or null
              disabled={Boolean(isChangingAppearanceRestricted)}
              clearable={false}
            />
          </Box>

          {props.hasMetadataAndDetails && (
            <Box className='form-builder-aside__row'>
              <Text className='form-builder-aside__header'>{t('Metadata')}</Text>

              <MetadataEditor
                survey={props.survey}
                onChange={props.onMetadataEditorChange}
                isDisabled={isChangingMetaQuestionsRestricted}
              />
            </Box>
          )}
        </Box>
      )}
      {props.asideLibrarySearchVisible && (
        <Box
          className={cx('form-builder-aside__content', isAddingQuestionsRestricted && LOCKING_UI_CLASSNAMES.DISABLED)}
        >
          <Box className='form-builder-aside__row'>
            <Text className='form-builder-aside__header'>{t('Search Library')}</Text>
          </Box>
          <Box className='form-builder-aside__row'>
            <AssetNavigator />
          </Box>
        </Box>
      )}
    </Box>
  )
}
