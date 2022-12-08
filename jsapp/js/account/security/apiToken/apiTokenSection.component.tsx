import React from 'react';
import ApiTokenDisplay from 'js/components/apiTokenDisplay';
import styles from './apiTokenSection.module.scss';

export default () => (
  <div className={styles.root}>
    <div className={styles.securityRowHeader}>
      <h2 className={styles.title}>{t('API Key')}</h2>
    </div>
    <ApiTokenDisplay />
  </div>
);
