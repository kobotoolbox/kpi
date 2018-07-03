import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import TextareaAutosize from 'react-autosize-textarea';
import {dataInterface} from '../dataInterface';
import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import TextBox from './textBox';
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
      fieldsErrors: {}
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
    if (currentAccount.extra_details == undefined) {
      currentAccount.extra_details = {};
    }

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
      ],
      fieldsErrors: {}
    };
  }

  updateProfile() {
    actions.misc.updateProfile(
      {
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
      },
      {
        onComplete: this.onUpdateComplete.bind(this),
        onFail: this.onUpdateFail.bind(this)
      }
    );
  }

  onUpdateComplete(data) {
    this.setState({fieldsErrors: {}});
  }

  onUpdateFail(data) {
    this.setState({fieldsErrors: data.responseJSON});
  }

  handleChange(evt, attr) {
    let val;
    if (evt && evt.target) {
      if (evt.target.type == 'checkbox') {
        val = evt.target.checked;
      } else {
        val = evt.target.value;
      }
    } else {
      // react-select and TextBox just passes a string
      val = evt;
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
      <DocumentTitle title={`${accountName} | KoboToolbox`}>
      <ui.Panel>
        <bem.AccountSettings>
          <bem.AccountSettings__item m={'column'}>
            <bem.AccountSettings__item m='actions'>
              <button
                onClick={this.updateProfile}
                className="mdl-button mdl-button--raised mdl-button--colored"
              >
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
                <bem.AccountSettings__item>
                  <label htmlFor="requireAuth">{t('Privacy')}</label>
                </bem.AccountSettings__item>

                <input
                  type='checkbox'
                  id="requireAuth"
                  checked={this.state.requireAuth}
                  onChange={this.requireAuthChange}
                />

                <label htmlFor="requireAuth">
                  {t('Require authentication to see forms and submit data')}
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  label={t('Name')}
                  errors={this.state.fieldsErrors.name}
                  value={this.state.name}
                  onChange={this.nameChange}
                  description={t('Use this to display your real name to other users')}
                />
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  label={t('Email')}
                  type='email'
                  errors={this.state.fieldsErrors.email}
                  value={this.state.email}
                  onChange={this.emailChange}
                />
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='password'>
                <a
                  href='/#/change-password'
                  className="mdl-button mdl-button--raised mdl-button--colored"
                >
                  {t('Modify Password')}
                </a>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  label={t('Organization')}
                  errors={this.state.fieldsErrors.organization}
                  value={this.state.organization}
                  onChange={this.organizationChange}
                />
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  label={t('Organization Website')}
                  type='url'
                  errors={this.state.fieldsErrors.organizationWebsite}
                  value={this.state.organizationWebsite}
                  onChange={this.organizationWebsiteChange}
                />

                <bem.AccountSettings__desc className="is-edge">
                  {t('This will be used to create a hyperlink for your organization name. ')}
                </bem.AccountSettings__desc>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <label>
                  {t('Primary Sector')}

                  <Select
                    value={this.state.primarySector}
                    options={this.state.sectorChoices}
                    onChange={this.primarySectorChange}
                  />
                </label>

                <bem.AccountSettings__desc>
                  {t('Select the primary sector in which you work. ')}
                </bem.AccountSettings__desc>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <label>
                  {t('Gender')}

                  <Select
                    value={this.state.gender}
                    options={this.state.genderChoices}
                    onChange={this.genderChange}
                  />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <label>
                  {t('Bio')}

                  <TextareaAutosize
                    onChange={this.bioChange}
                    value={this.state.bio}
                    id="bio"
                  />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  label={t('Phone Number')}
                  errors={this.state.fieldsErrors.phoneNumber}
                  value={this.state.phoneNumber}
                  onChange={this.phoneNumberChange}
                />
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  label={t('Address')}
                  errors={this.state.fieldsErrors.address}
                  value={this.state.address}
                  onChange={this.addressChange}
                />
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='city'>
                <TextBox
                  label={t('City')}
                  errors={this.state.fieldsErrors.city}
                  value={this.state.city}
                  onChange={this.cityChange}
                />
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='country'>
                <label>
                  {t('Country')}

                  <Select
                    value={this.state.country}
                    options={this.state.countryChoices}
                    onChange={this.countryChange}
                  />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item className="is-edge">
                <label>
                  {t('Default Form Language')}

                  <Select
                    value={this.state.defaultLanguage}
                    options={this.state.languageChoices}
                    onChange={this.defaultLanguageChange}
                  />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='social'>
                <label>{t('Social')}</label>

                <label>
                  <i className="fa fa-twitter" />

                  <input
                    type="text"
                    value={this.state.twitter}
                    onChange={this.twitterChange}
                  />
                </label>

                <label>
                  <i className="fa fa-linkedin" />

                  <input
                    type="text"
                    value={this.state.linkedin}
                    onChange={this.linkedinChange}
                  />
                </label>

                <label>
                  <i className="fa fa-instagram" />

                  <input
                    type="text"
                    value={this.state.instagram}
                    onChange={this.instagramChange}
                  />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item>
                <TextBox
                  label={t('Metadata')}
                  errors={this.state.fieldsErrors.metadata}
                  value={this.state.metadata}
                  onChange={this.metadataChange}
                />
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
    if (this.state.newPassword != this.state.verifyPassword) {
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

              <a href={`${dataInterface.rootUrl}/accounts/password/reset/`}>
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

            <bem.ChangePassword__item  m='actions'>
              <button
                onClick={this.changePassword}
                className="mdl-button mdl-button--raised mdl-button--colored"
              >
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
