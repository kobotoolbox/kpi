import React, {useEffect, useState} from 'react';
import sessionStore from 'js/stores/session';
import { EmailResponse, getUserEmails } from './emailSection.api';
import {PaginatedResponse} from 'jsapp/js/dataInterface';
import style from './emailSection.module.scss'

export default function EmailSection() {
  const [session] = useState(() => sessionStore);

  useEffect(() => {
    console.log('im in');
    getUserEmails().then((data) => {
      console.log(data);
    });
  });

  return (
    <div className={style['email-section']}>
			<h2>Email</h2>
      <h2>{
        !session.isPending &&
        session.isInitialLoadComplete &&
        'email' in session.currentAccount &&
        session.currentAccount.email
      }</h2>
    </div>
  );
}
