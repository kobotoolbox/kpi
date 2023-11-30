import React from 'react';
import classNames from 'classnames';
import Button from 'js/components/common/button';
import styles from './transferProjects.module.scss';

export default function TransferProjects() {
    return (
      <div className={styles.root}>
        <div className={styles.description}>
          <strong>{t('Transfer project ownership')}</strong>

          <div className={styles.copy}>
            {t(
              'Transfer ownership of this project to another user. All submissions, data storage, and transcription and translation usage for this project will be transferred to the new project owner.'
            )}
            &nbsp;
            <a>{t('Learn more')}</a>
            &nbsp;
            {t('→')}
          </div>
        </div>

        <Button label={t('Transfer')} isFullWidth onClick={() => console.log('yes')} color='storm' type='frame' size='l' />
      </div>
    );
}
