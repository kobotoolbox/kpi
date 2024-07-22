import React from 'react';
import Button from 'js/components/common/button';
import styles from './projectActions.module.scss';

const NO_PROJECT_SELECTED = t('No project selected');

/**
 * Inactive Quick Actions buttons. Show these when zero projects are selected
 * in the Project Table.
 */
export default function ProjectQuickActionsEmpty() {
  return (
    <div className={styles.root}>
      {/* Archive / Unarchive */}
      <Button
        isDisabled
        type='bare'
        color='dark-blue'
        size='s'
        startIcon='archived'
        tooltip={t('Archive/Unarchive') + ' – ' + NO_PROJECT_SELECTED}
        tooltipPosition='right'
      />

      {/* Share */}
      <Button
        isDisabled
        type='bare'
        color='dark-blue'
        size='s'
        startIcon='user-share'
        tooltip={t('Share project') + ' – ' + NO_PROJECT_SELECTED}
        tooltipPosition='right'
      />

      {/* Delete */}
      <Button
        isDisabled
        type='bare'
        color='dark-red'
        size='s'
        startIcon='trash'
        tooltip={t('Delete') + ' – ' + NO_PROJECT_SELECTED}
        tooltipPosition='right'
      />
    </div>
  );
}
