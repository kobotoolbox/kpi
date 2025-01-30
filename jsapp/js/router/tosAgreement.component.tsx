import React from 'react';
import styles from './tosAgreement.module.scss';
import BasicLayout from './basicLayout.component';
import TOSForm from 'js/tos/tosForm.component';

/**
 * This is a route blocker component to be used for accounts that have not
 * accepted the latest TOS. It is meant to be displayed for every possible
 * route - to block users from using the app befor taking action.
 */
export default function TOSAgreement() {
  return (
    <BasicLayout>
      <div className={styles.root}>
        <TOSForm />
      </div>
    </BasicLayout>
  );
}
