import React from 'react';
import Button from 'js/components/common/button';
import styles from './projectActions.module.scss';
import Tooltip from 'jsapp/js/components/common/tooltip';

const NO_PROJECT_SELECTED = t('No project selected');

/**
 * Inactive Quick Actions buttons. Show these when zero projects are selected
 * in the Project Table.
 */
export default function ProjectQuickActionsEmpty() {
  return (
    <div className={styles.root}>
      {/* Archive / Unarchive */}
      <Tooltip
        text={t('Archive/Unarchive') + ' – ' + NO_PROJECT_SELECTED}
        ariaLabel={t('Archive/Unarchive') + ' – ' + NO_PROJECT_SELECTED}
        className='right-tooltip'
      >
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='archived'
        />
      </Tooltip>

      {/* Share */}
      <Tooltip
        text={t('Share project') + ' – ' + NO_PROJECT_SELECTED}
        ariaLabel={t('Share project') + ' – ' + NO_PROJECT_SELECTED}
        className='right-tooltip'
      >
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='user-share'
        />
      </Tooltip>

      {/* Delete */}
      <Tooltip
        text={t('Delete') + ' – ' + NO_PROJECT_SELECTED}
        ariaLabel={t('Delete') + ' – ' + NO_PROJECT_SELECTED}
        className='right-tooltip'
      >
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='trash'
        />
      </Tooltip>
    </div>
  );
}
