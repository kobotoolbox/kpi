import React from 'react';
import {ROOT_URL} from 'js/constants';
import styles from './successRoute.module.scss';
import Icon from 'jsapp/js/components/common/icon';
import InlineMessage from "js/components/common/inlineMessage";

const SuccessRoute = () => {
  return (
    <article className={styles.container}>
      <a className={styles.backLink} href={ROOT_URL + '#/account/plan'}>
        <Icon name={'arrow-left'}/>
        <span>{'Go Back to Account Section'}</span>
      </a>
      <section className={styles.message}>
        <h2>{'Thank you for your purchase!'}</h2>
        <InlineMessage classNames={styles.details} type={'default'}
          message={`Your account should be updated shortly.
            Please check your e-mail and spam folder for updates from Stripe about the status of your transaction.`
          }
        />
      </section>
    </article>
  )
}

export default SuccessRoute;
