import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {actions} from '../actions';
import {bem} from '../bem';
import {stores} from '../stores';
import TextBox from './textBox';
import ui from '../ui';
import {
  t,
  stringToColor,
} from '../utils';
import {ROOT_URL} from 'js/constants';

export default class ChangePassword extends React.Component {
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

  componentDidMount() {
    this.listenTo(actions.auth.changePassword.failed, this.changePasswordFailed);
  }

  validateRequired(what) {
    if (!this.state[what]) {
      this.errors[what] = t('This field is required.');
    }
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

  changePasswordFailed(jqXHR) {
    if (jqXHR.responseJSON.current_password) {
      this.errors.currentPassword = jqXHR.responseJSON.current_password;
    }
    if (jqXHR.responseJSON.new_password) {
      this.errors.newPassword = jqXHR.responseJSON.new_password;
    }
    this.setState({errors: this.errors});
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
    if(!stores.session || !stores.session.currentAccount) {
      return (
        <ui.Panel>
          <bem.AccountSettings>
            <bem.AccountSettings__item>
              <bem.Loading>
                <bem.Loading__inner>
                  <i />
                  {t('loading...')}
                </bem.Loading__inner>
              </bem.Loading>
            </bem.AccountSettings__item>
          </bem.AccountSettings>
        </ui.Panel>
      );
    }

    var accountName = stores.session.currentAccount.username;
    var initialsStyle = {
      background: `#${stringToColor(accountName)}`
    };

    return (
      <ui.Panel>
        <bem.AccountSettings>
          <bem.ChangePassword>
            <bem.AccountSettings__item m='username'>
              <bem.AccountBox__initials style={initialsStyle}>
                {accountName.charAt(0)}
              </bem.AccountBox__initials>
              <h4>{accountName}</h4>
            </bem.AccountSettings__item>

            <bem.AccountSettings__item>
              <h4>{t('Reset Password')}</h4>
            </bem.AccountSettings__item>

            <bem.ChangePassword__item>
              <TextBox
                label={t('Current Password')}
                type='password'
                errors={this.state.errors.currentPassword}
                value={this.state.currentPassword}
                onChange={this.currentPasswordChange}
              />

              <a href={`${ROOT_URL}/accounts/password/reset/`}>
                {t('Forgot Password?')}
              </a>
            </bem.ChangePassword__item>

            <bem.ChangePassword__item>
              <TextBox
                label={t('New Password')}
                type='password'
                errors={this.state.errors.newPassword}
                value={this.state.newPassword}
                onChange={this.newPasswordChange}
              />
            </bem.ChangePassword__item>

            <bem.ChangePassword__item>
              <TextBox
                label={t('Verify Password')}
                type='password'
                errors={this.state.errors.verifyPassword}
                value={this.state.verifyPassword}
                onChange={this.verifyPasswordChange}
              />
            </bem.ChangePassword__item>

            <bem.ChangePassword__item m='actions'>
              <button
                onClick={this.changePassword}
                className='mdl-button mdl-button--raised mdl-button--colored'
              >
                {t('Save Changes')}
              </button>
            </bem.ChangePassword__item>
          </bem.ChangePassword>
        </bem.AccountSettings>
      </ui.Panel>
    );
  }
}

reactMixin(ChangePassword.prototype, Reflux.connect(stores.session, 'session'));
reactMixin(ChangePassword.prototype, Reflux.ListenerMixin);
