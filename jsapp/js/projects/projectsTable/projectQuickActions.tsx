import React from 'react';
import mixins from 'js/mixins';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
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
  replaceAssetForm,
  manageAssetLanguages,
  cloneAssetAsTemplate,
  cloneAssetAsSurvey,
} from 'jsapp/js/assetQuickActions';
import {downloadUrl} from 'jsapp/js/utils';
import type {IconName} from 'jsapp/fonts/k-icons';

interface ProjectQuickActionsProps {
  asset: AssetResponse | ProjectViewAsset;
}

export default function ProjectQuickActions(props: ProjectQuickActionsProps) {
  console.log('ProjectQuickActions', props);

  const userCanEdit = mixins.permissions.userCan('change_asset', props.asset);

  return (
    <div className={styles.root}>
      {userCanEdit && props.asset.asset_type !== ASSET_TYPES.collection.id && (
        <Button
          type='bare'
          color='storm'
          size='s'
          startIcon='edit'
          tooltip={t('Edit in Form Builder')}
          onClick={openInFormBuilder.bind(null, props.asset.uid)}
        />
      )}

      {userCanEdit &&
        props.asset.asset_type === ASSET_TYPES.survey.id &&
        props.asset.has_deployment &&
        props.asset.deployment__active && (
          <Button
            type='bare'
            color='storm'
            size='s'
            startIcon='archived'
            tooltip={t('Archive project')}
            onClick={archiveAsset.bind(null, props.asset)}
          />
        )}

      {userCanEdit &&
        props.asset.asset_type === ASSET_TYPES.survey.id &&
        props.asset.has_deployment &&
        props.asset.deployment__active && (
          <Button
            type='bare'
            color='storm'
            size='s'
            startIcon='archived'
            tooltip={t('Unarchive project')}
            onClick={unarchiveAsset.bind(null, props.asset)}
          />
        )}

      <Button
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        tooltip={t('Share project')}
        onClick={manageAssetSharing.bind(null, props.asset.uid)}
      />

      <KoboDropdown
        name='project-quick-actions'
        placement='down-left'
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
              onClick={cloneAsset.bind(null, props.asset)}
              label={t('Clone')}
            />

            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='replace'
              onClick={replaceAssetForm.bind(null, props.asset)}
              label={t('Replace form')}
            />

            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='language'
              onClick={manageAssetLanguages.bind(null, props.asset.uid)}
              label={t('Manage translations')}
            />

            {'downloads' in props.asset &&
              props.asset.downloads.map((file) => {
                let icon: IconName = 'file';
                if (file.format === 'XML') {
                  icon = 'file-xml';
                } else if (file.format === 'XLS') {
                  icon = 'file-xls';
                }

                return (
                  <Button
                    key={file.format}
                    type='bare'
                    color='storm'
                    size='s'
                    startIcon={icon}
                    onClick={downloadUrl.bind(null, file.url)}
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

            {userCanEdit && (
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='duplicate'
                onClick={() =>
                  deleteAsset(
                    props.asset,
                    getAssetDisplayName(props.asset).final,
                    () => {
                      console.log('after delete');
                    }
                  )
                }
                label={t('Delete')}
              />
            )}
          </div>
        }
      />
    </div>
  );
}
