import React from 'react';
import bem, {makeBem} from 'js/bem';
import {redirectToLogin} from 'js/router/routerUtils';
import {stores} from 'js/stores';
import {replaceBracketsWithLink} from 'utils';

import envStore from 'js/envStore';
import './accessDenied.scss';

bem.AccessDenied = makeBem(null, 'access-denied');
bem.AccessDenied__body = makeBem(bem.AccessDenied, 'body', 'section');
bem.AccessDenied__header = makeBem(bem.AccessDenied, 'header', 'header');
bem.AccessDenied__text = makeBem(bem.AccessDenied, 'text', 'section');

/**
 * @prop {string} [errorMessage]
 */
export default class AccessDenied extends React.Component {
  constructor(props) {
    super(props);
  }

  goToLogin(evt) {
    evt.preventDefault();
    redirectToLogin();
  }

  render() {
    let messageText;

    if (stores.session.isLoggedIn) {
      messageText = t(`Please try logging in using the header button or [contact the support team] if you think it's an error.`);
    } else {
      messageText = t(`Please [contact the support team] if you think it's an error.`);
    }

    let messageHtml = replaceBracketsWithLink(messageText, envStore.data.support_url);

    return (
      <bem.AccessDenied>
        <bem.AccessDenied__body>
          <bem.AccessDenied__header>
            <i className='k-icon k-icon-lock-alt'/>
            {t('Access denied')}
          </bem.AccessDenied__header>

          <bem.AccessDenied__text>
            {t("Either you don't have access to this page or this page simply doesn't exist.")}

            <p dangerouslySetInnerHTML={{__html: messageHtml}} />
          </bem.AccessDenied__text>

          {this.props.errorMessage &&
            <bem.AccessDenied__text>
              {t('Additional details:')}

              <code>{this.props.errorMessage}</code>
            </bem.AccessDenied__text>
          }
        </bem.AccessDenied__body>
      </bem.AccessDenied>
    );
  }
}
