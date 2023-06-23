import React from 'react';
import DocumentTitle from 'react-document-title';
import {observer} from 'mobx-react';
import sessionStore from 'js/stores/session';
import bem, {makeBem} from 'js/bem';
import {stringToColor} from 'js/utils';
import {withRouter} from 'js/router/legacy';
import type {WithRouterProps} from 'jsapp/js/router/legacy';
import './accountSettings.scss';
import styles from './changePasswordRoute.module.scss';
import UpdatePasswordForm from './security/password/updatePasswordForm.component';

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

const ChangePasswordRoute = class ChangePassword extends React.Component<WithRouterProps> {
  close() {
    this.props.router.navigate(-1);
  }

  render() {
    if (!sessionStore.isLoggedIn) {
      return null;
    }

    const accountName = sessionStore.currentAccount.username;
    const initialsStyle = {background: `#${stringToColor(accountName)}`};

    return (
      <DocumentTitle title={`${accountName} | KoboToolbox`}>
        <bem.AccountSettings>
          <bem.AccountSettings__actions>
            <button
              onClick={this.close.bind(this)}
              className='account-settings-close mdl-button mdl-button--icon'
            >
              <i className='k-icon k-icon-close' />
            </button>
          </bem.AccountSettings__actions>

          <bem.AccountSettings__item m='column'>
            <bem.AccountSettings__item m='username'>
              <bem.AccountBox__initials style={initialsStyle}>
                {accountName.charAt(0)}
              </bem.AccountBox__initials>
              <h4>{accountName}</h4>
            </bem.AccountSettings__item>

            <div className={styles.fieldsWrapper}>
              <UpdatePasswordForm />
            </div>
          </bem.AccountSettings__item>
        </bem.AccountSettings>
      </DocumentTitle>
    );
  }
};

export default observer(withRouter(ChangePasswordRoute));
