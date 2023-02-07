import React from 'react';
import type {
  AssetResponse,
  ProjectViewAsset,
  DeploymentResponse,
} from 'js/dataInterface';
import {ASSET_TYPES} from 'js/constants';
import Button from 'js/components/common/button';
import KoboDropdown from 'jsapp/js/components/common/koboDropdown';
import styles from './projectQuickActions.module.scss';
import {getAssetDisplayName} from 'jsapp/js/assetUtils';
import {
  archiveAsset,
  unarchiveAsset,
  deleteAsset,
  openInFormBuilder,
  manageAssetSharing,
  cloneAsset,
  deployAsset,
  replaceAssetForm,
  manageAssetLanguages,
  cloneAssetAsTemplate,
  cloneAssetAsSurvey,
} from 'jsapp/js/assetQuickActions';
import {downloadUrl} from 'jsapp/js/utils';
import type {IconName} from 'jsapp/fonts/k-icons';
import {userCan} from 'js/components/permissions/utils';
import customViewStore from 'js/projects/customViewStore';

interface ProjectQuickActionsProps {
  asset: AssetResponse | ProjectViewAsset;
}

export default function ProjectQuickActions(props: ProjectQuickActionsProps) {
  // The `userCan` method requires `permissions` property to be present in the
  // `asset` object. For performance reasons `ProjectViewAsset` doesn't have
  // that property, and it is fine, as we don't expect Project View to have
  // a lot of options available.
  const isChangingPossible = userCan('change_asset', props.asset);
  const isManagingPossible = userCan('manage_asset', props.asset);

  return (
    <div className={styles.root}>
      <Button
        isDisabled={
          !isChangingPossible ||
          props.asset.asset_type !== ASSET_TYPES.survey.id
        }
        type='bare'
        color='storm'
        size='s'
        startIcon='edit'
        tooltip={t('Edit in Form Builder')}
        onClick={() => openInFormBuilder(props.asset.uid)}
      />

      {props.asset.deployment__active && (
        <Button
          isDisabled={
            !isChangingPossible ||
            props.asset.asset_type !== ASSET_TYPES.survey.id ||
            !props.asset.has_deployment
          }
          type='bare'
          color='storm'
          size='s'
          startIcon='archived'
          tooltip={t('Archive project')}
          onClick={() =>
            archiveAsset(props.asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset);
            })
          }
        />
      )}

      {!props.asset.deployment__active && (
        <Button
          isDisabled={
            !isChangingPossible ||
            props.asset.asset_type !== ASSET_TYPES.survey.id ||
            !props.asset.has_deployment
          }
          type='bare'
          color='storm'
          size='s'
          startIcon='archived'
          tooltip={t('Unarchive project')}
          onClick={() =>
            unarchiveAsset(props.asset, customViewStore.handleAssetChanged)
          }
        />
      )}

      <Button
        isDisabled={!isManagingPossible}
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        tooltip={t('Share project')}
        onClick={() => manageAssetSharing(props.asset.uid)}
      />

      <Button
        isDisabled={!isChangingPossible}
        type='bare'
        color='storm'
        size='s'
        startIcon='trash'
        tooltip={t('Delete')}
        onClick={() =>
          deleteAsset(
            props.asset,
            getAssetDisplayName(props.asset).final,
            customViewStore.handleAssetDeleted
          )
        }
      />

      <KoboDropdown
        name='project-quick-actions'
        placement='down-right'
        hideOnMenuClick
        triggerContent={
          <Button type='bare' color='storm' size='s' startIcon='more' />
        }
        menuContent={
          <div className={styles.menu}>
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='duplicate'
              onClick={() => cloneAsset(props.asset)}
              label={t('Clone')}
            />

            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='deploy'
              onClick={() =>
                deployAsset(props.asset, customViewStore.handleAssetChanged)
              }
              label={t('Deploy')}
            />

            <Button
              isDisabled={!isChangingPossible}
              type='bare'
              color='storm'
              size='s'
              startIcon='replace'
              onClick={() => replaceAssetForm(props.asset)}
              label={t('Replace form')}
            />

            <Button
              isDisabled={!isChangingPossible}
              type='bare'
              color='storm'
              size='s'
              startIcon='language'
              onClick={() => manageAssetLanguages(props.asset.uid)}
              label={t('Manage translations')}
            />

            {'downloads' in props.asset &&
              props.asset.downloads.map((file) => {
                let icon: IconName = 'file';
                if (file.format === 'xml') {
                  icon = 'file-xml';
                } else if (file.format === 'xls') {
                  icon = 'file-xls';
                }

                return (
                  <Button
                    key={file.format}
                    type='bare'
                    color='storm'
                    size='s'
                    startIcon={icon}
                    onClick={() => downloadUrl(file.url)}
                    label={
                      <span>
                        {t('Download')}&nbsp;
                        {file.format.toString().toUpperCase()}
                      </span>
                    }
                  />
                );
              })}

            {props.asset.asset_type === ASSET_TYPES.survey.id && (
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='template'
                onClick={cloneAssetAsTemplate.bind(
                  null,
                  props.asset.uid,
                  getAssetDisplayName(props.asset).final
                )}
                label={t('Create template')}
              />
            )}

            {props.asset.asset_type === ASSET_TYPES.template.id && (
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='projects'
                onClick={cloneAssetAsSurvey.bind(
                  null,
                  props.asset.uid,
                  getAssetDisplayName(props.asset).final
                )}
                label={t('Create project')}
              />
            )}
          </div>
        }
      />
    </div>
  );
}
