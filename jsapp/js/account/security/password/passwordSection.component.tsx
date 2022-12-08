import React from 'react';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import bem, {makeBem} from 'js/bem';
import TextBox from 'js/components/common/textBox';
import {PATHS} from 'js/router/routerConstants';

bem.SecurityRow = makeBem(null, 'security-row');
bem.SecurityRow__header = makeBem(bem.SecurityRow, 'header');
bem.SecurityRow__title = makeBem(bem.SecurityRow, 'title', 'h2');
bem.SecurityRow__buttons = makeBem(bem.SecurityRow, 'buttons');
bem.SecurityRow__link = makeBem(bem.SecurityRow, 'link')

const HIDDEN_TOKEN_VALUE = '*'.repeat(10);

export default function PasswordSection () {
  return (
    <bem.SecurityRow>
      <bem.SecurityRow__header>
        <bem.SecurityRow__title>
          {t('Password')}
        </bem.SecurityRow__title>
      </bem.SecurityRow__header>
      <TextBox
        customModifiers='on-white'
        type='password'
        value={HIDDEN_TOKEN_VALUE}
        readOnly
      />
      <bem.SecurityRow__link>
        <a 
          href={PATHS.RESET}
        >
          {t('forgot password')}
        </a>
      </bem.SecurityRow__link>
      <bem.SecurityRow__buttons>
        <a
          href={`/#${ACCOUNT_ROUTES.CHANGE_PASSWORD}`}
          className='kobo-button kobo-button--blue'
        >
          {t('update')}
        </a>
      </bem.SecurityRow__buttons>

    </bem.SecurityRow>
  );
}