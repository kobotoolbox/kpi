import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';
import DocumentTitle from 'react-document-title';
import TextareaAutosize from 'react-autosize-textarea';

import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import ui from '../ui';
import $ from 'jquery';
import {
  assign,
  t,
  log,
  stringToColor,
} from '../utils';

export class AccountSettings extends React.Component {
  constructor(props){
    super(props);
    let state = {
      requireAuth: false,
    }
    this.state = state;
    autoBind(this);
    if (stores.session && stores.session.currentAccount) {
      this.state = this.getStateFromCurrentAccount(stores.session.currentAccount);
    }
  }
  componentDidMount() {
    this.listenTo(stores.session, ({currentAccount}) => {
      this.setState(this.getStateFromCurrentAccount(currentAccount));
    });
  }
  getStateFromCurrentAccount(currentAccount) {
    if (currentAccount.extra_details == undefined)
      currentAccount.extra_details = {};
    return {
      name: currentAccount.extra_details.name,
      email: currentAccount.email,
      organization: currentAccount.extra_details.organization,
      organizationWebsite: currentAccount.extra_details.organization_website,
      primarySector: currentAccount.extra_details.primarySector,
      gender: currentAccount.extra_details.gender,
      bio: currentAccount.extra_details.bio,
      phoneNumber: currentAccount.extra_details.phone_number,
      address: currentAccount.extra_details.address,
      city: currentAccount.extra_details.city,
      country: currentAccount.extra_details.country,
      defaultLanguage: currentAccount.extra_details.default_language,
      requireAuth: currentAccount.extra_details.require_auth,
      twitter: currentAccount.extra_details.twitter,
      linkedin: currentAccount.extra_details.linkedin,
      instagram: currentAccount.extra_details.instagram,
      metadata: currentAccount.extra_details.metadata,

      languageChoices: currentAccount.all_languages,
      countryChoices: currentAccount.available_countries,
      sectorChoices: currentAccount.available_sectors,
      genderChoices: [
        {
          value: 'male',
          label: t('Male')
        },
        {
          value: 'female',
          label: t('Female')
        },
        {
          value: 'other',
          label: t('Other')
        },
      ]
    };
  }
  updateProfile () {
    actions.misc.updateProfile({
      email: this.state.email,
      extra_details: JSON.stringify({
        name: this.state.name,
        organization: this.state.organization,
        organization_website: this.state.organizationWebsite,
        primarySector: this.state.primarySector,
        gender: this.state.gender,
        bio: this.state.bio,
        phone_number: this.state.phoneNumber,
        address: this.state.address,
        city: this.state.city,
        country: this.state.country,
        default_language: this.state.defaultLanguage,
        require_auth: this.state.requireAuth,
        twitter: this.state.twitter,
        linkedin: this.state.linkedin,
        instagram: this.state.instagram,
        metadata: this.state.metadata,
      })
    });
  }
  handleChange (e, attr) {
    if (e.target) {
      if (e.target.type == 'checkbox') {
        var val = e.target.checked;
      } else {
        var val = e.target.value;
      }
    } else {
      // react-select just passes a string
      var val = e;
    }
    this.setState({[attr]: val});
  }
  nameChange (e) {this.handleChange(e, 'name');}
  emailChange (e) {this.handleChange(e, 'email');}
  organizationChange (e) {this.handleChange(e, 'organization');}
  organizationWebsiteChange (e) {this.handleChange(e, 'organizationWebsite');}
  primarySectorChange (e) {this.handleChange(e, 'primarySector');}
  genderChange (e) {this.handleChange(e, 'gender');}
  bioChange (e) {this.handleChange(e, 'bio');}
  phoneNumberChange (e) {this.handleChange(e, 'phoneNumber');}
  addressChange (e) {this.handleChange(e, 'address');}
  cityChange (e) {this.handleChange(e, 'city');}
  countryChange (e) {this.handleChange(e, 'country');}
  defaultLanguageChange (e) {this.handleChange(e, 'defaultLanguage');}
  requireAuthChange (e) {this.handleChange(e, 'requireAuth');}
  twitterChange (e) {this.handleChange(e, 'twitter');}
  linkedinChange (e) {this.handleChange(e, 'linkedin');}
  instagramChange (e) {this.handleChange(e, 'instagram');}
  metadataChange (e) {this.handleChange(e, 'metadata');}

  render () {
    if(!stores.session || !stores.session.currentAccount) {
      return (
        <ui.Panel>
          <bem.AccountSettings>
            <bem.AccountSettings__item>
              {t('loading...')}
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
      <DocumentTitle title={`${accountName} | KoboToolbox`}>
      <ui.Panel>
        <bem.AccountSettings>
          <bem.AccountSettings__item m={'column'}>
            <bem.AccountSettings__item m='actions'>
              <button onClick={this.updateProfile}
                      className="mdl-button mdl-button--raised mdl-button--colored">
                {t('Save Changes')}
              </button>
            </bem.AccountSettings__item>
            <bem.AccountSettings__item m='username'>
              <bem.AccountBox__initials style={initialsStyle}>
                {accountName.charAt(0)}
              </bem.AccountBox__initials>
              <h4>{accountName}</h4>
            </bem.AccountSettings__item>
            <bem.AccountSettings__item m='fields'>
              <bem.AccountSettings__item>
                <label htmlFor="requireAuth">
                  {t('Privacy')}
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <input type="checkbox" 
                  id="requireAuth"
                  checked={this.state.requireAuth}
                  onChange={this.requireAuthChange} />
                <label htmlFor="requireAuth">
                  {t('Require authentication to see forms and submit data')}
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Name')}
                  <input type="text" value={this.state.name}
                    onChange={this.nameChange} />
                </label>
                <bem.AccountSettings__desc>
                  {t('Use this to display your real name to other users')}
                </bem.AccountSettings__desc>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Email')}
                  <input type="email" value={this.state.email}
                    onChange={this.emailChange} />
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item m='password'>
                <a href='/#/change-password'
                    className="mdl-button mdl-button--raised mdl-button--colored">
                  {t('Modify Password')}
                </a>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Organization')}
                  <input type="text" value={this.state.organization}
                    onChange={this.organizationChange} />
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Organization Website')}
                  <input type="text" value={this.state.organizationWebsite}
                    onChange={this.organizationWebsiteChange} />
                </label>
                <bem.AccountSettings__desc className="is-edge">
                  {t('This will be used to create a hyperlink for your organization name. ')}
                </bem.AccountSettings__desc>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Primary Sector')}
                  <Select value={this.state.primarySector}
                    options={this.state.sectorChoices}
                    onChange={this.primarySectorChange}>
                  </Select>
                </label>
                <bem.AccountSettings__desc>
                  {t('Select the primary sector in which you work. ')}
                </bem.AccountSettings__desc>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Gender')}
                  <Select value={this.state.gender}
                    options={this.state.genderChoices}
                    onChange={this.genderChange}>
                  </Select>
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Bio')}
                  <TextareaAutosize onChange={this.bioChange} value={this.state.bio} id="bio" />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <label>
                  {t('Phone Number')}
                  <input type="text" value={this.state.phoneNumber}
                    onChange={this.phoneNumberChange} />
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Address')}
                  <input type="text" value={this.state.address}
                    onChange={this.addressChange} />
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item m='city'>
                <label>
                  {t('City')}
                  <input type="text" value={this.state.city}
                    onChange={this.cityChange} />
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item m='country'>
                <label>
                  {t('Country')}
                  <Select value={this.state.country}
                    options={this.state.countryChoices}
                    onChange={this.countryChange}>
                  </Select>
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item className="is-edge">
                <label>
                  {t('Default Form Language')}
                  <Select value={this.state.defaultLanguage}
                    options={this.state.languageChoices}
                    onChange={this.defaultLanguageChange}>
                  </Select>
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item m='social'>
                <label>
                  {t('Social')}
                </label>
                <label>
                  <i className="fa fa-twitter" />
                  <input type="text" value={this.state.twitter}
                    onChange={this.twitterChange} />
                </label>
                <label>
                  <i className="fa fa-linkedin" />
                  <input type="text" value={this.state.linkedin}
                    onChange={this.linkedinChange} />
                </label>
                <label>
                  <i className="fa fa-instagram" />
                  <input type="text" value={this.state.instagram}
                    onChange={this.instagramChange} />
                </label>
              </bem.AccountSettings__item>
              <bem.AccountSettings__item>
                <label>
                  {t('Metadata')}
                  <input type="text" value={this.state.metadata}
                    onChange={this.metadataChange} />
                </label>
              </bem.AccountSettings__item>
            </bem.AccountSettings__item>
          </bem.AccountSettings__item>
        </bem.AccountSettings>
      </ui.Panel>
      </DocumentTitle>
    );
  }
};

reactMixin(AccountSettings.prototype, Reflux.connect(stores.session, 'session'));
reactMixin(AccountSettings.prototype, Reflux.ListenerMixin);

export class ChangePassword extends React.Component {
  constructor (props) {
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
  componentDidMount () {
    this.listenTo(
      actions.auth.changePassword.failed, this.changePasswordFailed);
  }
  validateRequired (what) {
    if (!this.state[what]) {
      this.errors[what] = t('This field is required.');
    }
  }
  changePassword () {
    this.errors = {};
    this.validateRequired('currentPassword');
    this.validateRequired('newPassword');
    this.validateRequired('verifyPassword');
    if (this.state.newPassword != this.state.verifyPassword) {
      this.errors['newPassword'] =
        t('This field must match the Verify Password field.');
    }
    if (Object.keys(this.errors).length === 0) {
      actions.auth.changePassword(
        this.state.currentPassword, this.state.newPassword
      );
    }
    this.setState({errors: this.errors});
  }
  changePasswordFailed (jqXHR) {
    if (jqXHR.responseJSON.current_password) {
      this.errors.currentPassword = jqXHR.responseJSON.current_password;
    }
    if (jqXHR.responseJSON.new_password) {
      this.errors.newPassword = jqXHR.responseJSON.new_password;
    }
    this.setState({errors: this.errors});
  }
  currentPasswordChange (e) {
    this.setState({currentPassword: e.target.value});
  }
  newPasswordChange (e) {
    this.setState({newPassword: e.target.value});
  }
  verifyPasswordChange (e) {
    this.setState({verifyPassword: e.target.value});
  }
  render () {
    if(!stores.session || !stores.session.currentAccount) {
      return (
        <ui.Panel>
          <bem.AccountSettings>
            <bem.AccountSettings__item>
              {t('loading...')}
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

            <h4>{t('Reset Password')}</h4>

            <bem.ChangePassword__item>
              <label>
                {t('Current Password')}
                <input type="password" value={this.state.currentPassword}
                  onChange={this.currentPasswordChange} />
                {this.state.errors.currentPassword}
              </label>
              <a href={`${dataInterface.rootUrl}/accounts/password/reset/`}>
                {t('Forgot Password?')}
              </a>
            </bem.ChangePassword__item>
            <bem.ChangePassword__item>
              <label>
                {t('New Password')}
                <input type="password" value={this.state.newPassword}
                  onChange={this.newPasswordChange} />
                {this.state.errors.newPassword}
              </label>
            </bem.ChangePassword__item>
            <bem.ChangePassword__item>
              <label>
                {t('Verify Password')}
                <input type="password" value={this.state.verifyPassword}
                  onChange={this.verifyPasswordChange} />
                {this.state.errors.verifyPassword}
              </label>
            </bem.ChangePassword__item>
            <bem.ChangePassword__item  m='actions'>
              <button onClick={this.changePassword}
                      className="mdl-button mdl-button--raised mdl-button--colored">
                {t('Save Changes')}
              </button>
            </bem.ChangePassword__item>
          </bem.ChangePassword>
        </bem.AccountSettings>
      </ui.Panel>
    );
  }
};

reactMixin(ChangePassword.prototype, Reflux.connect(stores.session, 'session'));
reactMixin(ChangePassword.prototype, Reflux.ListenerMixin);