import React from 'react';
import InlineMessage from '../components/common/inlineMessage';
import styles from './invalidatedPassword.module.scss';


export default function InvalidatedPassword() {
  return (
    <div className={styles.root}>
      <InlineMessage type='error' icon='alert' message={
        t('Your password is not meeting the security requirements.')
      } />

      <p>{t('Until you update it, most of the KoboToolbox would be inacessible.')}</p>
    </div>
  );
}
