import React from 'react';
import Button from 'js/components/common/button';
import styles from './projectActions.module.scss';

const NO_PROJECT_SELECTED = t('No project selected');

export default function ProjectQuickActions() {
  return (
    <div className={styles.root}>
      {/* Archive / Unarchive */}
      <Button
        isDisabled
        type='bare'
        color='storm'
        size='s'
        startIcon='archived'
        tooltip={t('Archive/Unarchive') + ' – ' + NO_PROJECT_SELECTED}
        classNames={['right-tooltip']}
      />

      {/* Share */}
      <Button
        isDisabled
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        tooltip={t('Share project') + ' – ' + NO_PROJECT_SELECTED}
        classNames={['right-tooltip']}
      />

      {/* Delete */}
      <Button
        isDisabled
        type='bare'
        color='storm'
        size='s'
        startIcon='trash'
        tooltip={t('Delete') + ' – ' + NO_PROJECT_SELECTED}
        classNames={['right-tooltip']}
      />
    </div>
  );
}
