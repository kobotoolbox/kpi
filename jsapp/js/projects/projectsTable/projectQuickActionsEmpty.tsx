import React from 'react';
import Button from 'js/components/common/button';
import styles from './projectActions.module.scss';

const NO_PROJECT_SELECTED = t('No project selected');

/** Inactive Quick Actions buttons. Show these when zero projects are selected
 * in the Project Table. */
export default function ProjectQuickActionsEmpty() {
  return (
    <div className={styles.root}>
      {/* Archive / Unarchive */}
      <span
        data-tip={t('Archive/Unarchive') + ' – ' + NO_PROJECT_SELECTED}
        className='right-tooltip'
      >
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='archived'
        />
      </span>

      {/* Share */}
      <span
        data-tip={t('Share project') + ' – ' + NO_PROJECT_SELECTED}
        className='right-tooltip'
      >
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='user-share'
        />
      </span>

      {/* Delete */}
      <span
        data-tip={t('Delete') + ' – ' + NO_PROJECT_SELECTED}
        className='right-tooltip'
      >
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='trash'
        />
      </span>
    </div>
  );
}
