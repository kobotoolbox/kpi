import React from 'react';
import {bem} from 'js/bem';
import {redirectToLogin} from 'js/router/routerUtils';
import {stores} from 'js/stores';
import envStore from 'js/envStore';
import './accessDenied.scss';

bem.AccessDenied = bem.create('access-denied');
bem.AccessDenied__body = bem.AccessDenied.__('body', 'section');
bem.AccessDenied__header = bem.AccessDenied.__('header', 'header');
bem.AccessDenied__text = bem.AccessDenied.__('text', 'section');

export default class AccessDenied extends React.Component {
  constructor(props) {
    super(props);
  }

  goToLogin(evt) {
    evt.preventDefault();
    redirectToLogin();
  }

  render() {
    return (
      <bem.AccessDenied>
        <bem.AccessDenied__body>
          <bem.AccessDenied__header>
            <i className='k-icon k-icon-lock-alt'/>
            {t('Access denied')}
          </bem.AccessDenied__header>

          <bem.AccessDenied__text>
            {t("Either you don't have access to this route or this route simply doesn't exist.")}

            <br/>

            {stores.session.isLoggedIn ?
              t('Please ')
              :
              t('Please try logging in using the header button or ')
            }

            {envStore.data.support_url ?
              <a href={envStore.data.support_url} target='_blank'>{t('contact the support team')}</a>
              :
              t('contact the support team')
            }
            {t(" if you think it's an error.")}
          </bem.AccessDenied__text>
        </bem.AccessDenied__body>
      </bem.AccessDenied>
    );
  }
}
