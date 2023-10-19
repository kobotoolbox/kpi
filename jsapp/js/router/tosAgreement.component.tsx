import React, {useState} from 'react';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import styles from './tosAgreement.module.scss';
import BasicLayout from './basicLayout.component';

/**
 * This is a route blocker component to be used for accounts that have not
 * accepted the latest TOS. It is meant to be displayed for every possible
 * route - to block users from using the app befor taking action.
 */
export default function TOSAgreement() {
  return (
    <BasicLayout>
      <div className={styles.root}>TOS agreement here :)</div>
    </BasicLayout>
  );
}
