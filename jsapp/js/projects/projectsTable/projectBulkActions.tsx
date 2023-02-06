import React from 'react';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
import Button from 'js/components/common/button';
import KoboDropdown from 'jsapp/js/components/common/koboDropdown';
import styles from './projectQuickActions.module.scss';

interface ProjectBulkActionsProps {
  assets: Array<AssetResponse | ProjectViewAsset>;
}

export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  console.log('ProjectBulkActions', props);

  return (
    <div className={styles.root}>
      <Button
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        tooltip={t('Share project')}
        onClick={() => console.log('share')}
      />

      <KoboDropdown
        name='project-bulk-actions'
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
              onClick={() => console.log('clone')}
              label={t('clone')}
            />
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='duplicate'
              onClick={() => console.log('replace form')}
              label={t('replace form')}
            />
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='duplicate'
              onClick={() => console.log('manage translations')}
              label={t('manage translations')}
            />
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='duplicate'
              onClick={() => console.log('downloads')}
              label={t('downloads')}
            />
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='duplicate'
              onClick={() => console.log('create template')}
              label={t('create template')}
            />
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='duplicate'
              onClick={() => console.log('delete')}
              label={t('delete')}
            />
          </div>
        }
      />
    </div>
  );
}
