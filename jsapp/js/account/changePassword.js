import React from 'react';
import autoBind from 'react-autobind';
import DocumentTitle from 'react-document-title';
import { observer } from 'mobx-react';
import sessionStore from "js/stores/session";
import {actions} from '../actions';
import bem, {makeBem} from 'js/bem';
import TextBox from 'js/components/common/textBox';
import PasswordStrength from 'js/components/passwordStrength';
import {stringToColor} from 'utils';
import {ROOT_URL} from 'js/constants';
import {withRouter} from 'js/router/legacy';
import './accountSettings.scss';

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

const ChangePassword = class ChangePassword extends React.Component {
  constructor(props) {
    super(props);
    this.errors = {};
    this.state = {
      errors: this.errors,
      currentPassword: '',
      newPassword: '',
      verifyPassword: ''
    };
    autoBind(this);
  }

  validateRequired(what) {
    if (!this.state[what]) {
      this.errors[what] = t('This field is required.');
    }
  }

  close() {
    this.props.router.navigate(-1)
  }

  changePassword() {
    this.errors = {};
    this.validateRequired('currentPassword');
    this.validateRequired('newPassword');
    this.validateRequired('verifyPassword');
    if (this.state.newPassword !== this.state.verifyPassword) {
      this.errors['newPassword'] = t('This field must match the Verify Password field.');
    }
    if (Object.keys(this.errors).length === 0) {
      actions.auth.changePassword(this.state.currentPassword, this.state.newPassword);
    }
    this.setState({errors: this.errors});
  }

  onChangePasswordFailed(jqXHR) {
    if (jqXHR.responseJSON.current_password) {
      this.errors.currentPassword = jqXHR.responseJSON.current_password;
    }
    if (jqXHR.responseJSON.new_password) {
      this.errors.newPassword = jqXHR.responseJSON.new_password;
    }
    this.setState({errors: this.errors});
  }

  onChangePasswordCompleted() {
    this.close();
  }

  currentPasswordChange(val) {
    this.setState({currentPassword: val});
  }

  newPasswordChange(val) {
    this.setState({newPassword: val});
  }

  verifyPasswordChange(val) {
    this.setState({verifyPassword: val});
  }

  render() {
    if(!sessionStore.isLoggedIn) {
      return null;
    }

    var accountName = sessionStore.currentAccount.username;
    var initialsStyle = {
      background: `#${stringToColor(accountName)}`
    };

    return (
      <DocumentTitle title={`${accountName} | KoboToolbox`}>
        <bem.AccountSettings>
          <bem.AccountSettings__actions>
            <bem.KoboButton
              onClick={this.changePassword}
              m={['blue']}
            >
              {t('Save Password')}
            </bem.KoboButton>

            <button
              onClick={this.close}
              className='account-settings-close mdl-button mdl-button--icon'
            >
              <i className='k-icon k-icon-close'/>
            </button>
          </bem.AccountSettings__actions>

          <bem.AccountSettings__item m={'column'}>
            <bem.AccountSettings__item m='username'>
              <bem.AccountBox__initials style={initialsStyle}>
                {accountName.charAt(0)}
              </bem.AccountBox__initials>
              <h4>{accountName}</h4>
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='fields'>
              <bem.AccountSettings__item>
                <h4>{t('Reset Password')}</h4>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  customModifiers='on-white'
                  label={t('Current Password')}
                  type='password'
                  errors={this.state.errors.currentPassword}
                  value={this.state.currentPassword}
                  onChange={this.currentPasswordChange}
                />

                <a
                  className='account-settings-link'
                  href={`${ROOT_URL}/accounts/password/reset/`}
                >
                  {t('Forgot Password?')}
                </a>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  customModifiers='on-white'
                  label={t('New Password')}
                  type='password'
                  errors={this.state.errors.newPassword}
                  value={this.state.newPassword}
                  onChange={this.newPasswordChange}
                />
              </bem.AccountSettings__item>

              {
                this.state.newPassword !== '' &&
                <bem.AccountSettings__item>
                  <PasswordStrength password={this.state.newPassword} />
                </bem.AccountSettings__item>
              }

              <bem.AccountSettings__item>
                <TextBox
                  customModifiers='on-white'
                  label={t('Verify Password')}
                  type='password'
                  errors={this.state.errors.verifyPassword}
                  value={this.state.verifyPassword}
                  onChange={this.verifyPasswordChange}
                />
              </bem.AccountSettings__item>
            </bem.AccountSettings__item>
          </bem.AccountSettings__item>
        </bem.AccountSettings>
      </DocumentTitle>
    );
  }
}

export default observer(withRouter(ChangePassword));