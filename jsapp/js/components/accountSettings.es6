import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import TextareaAutosize from 'react-autosize-textarea';
import alertify from 'alertifyjs';
import {actions} from '../actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from '../stores';
import Select from 'react-select';
import TextBox from 'js/components/common/textBox';
import Checkbox from 'js/components/common/checkbox';
import ApiTokenDisplay from './apiTokenDisplay';
import {hashHistory} from 'react-router';
import {stringToColor} from 'utils';
import {ROUTES} from 'js/router/routerConstants';
import envStore from 'js/envStore';
import './accountSettings.scss';

const UNSAVED_CHANGES_WARNING = t('You have unsaved changes. Leave settings without saving?');

export default class AccountSettings extends React.Component {
  constructor(props){
    super(props);
    let state = {
      isPristine: true,
      requireAuth: false,
      fieldsErrors: {}
    };
    this.state = state;
    autoBind(this);
  }

  rebuildState() {
    if (
      stores.session.isLoggedIn &&
      envStore.isReady
    ) {
      this.setStateFromSession(
        stores.session.currentAccount,
        envStore.data
      );
    }
  }

  componentDidMount() {
    this.props.router.setRouteLeaveHook(this.props.route, this.routerWillLeave);
    this.listenTo(stores.session, this.rebuildState);
    this.rebuildState();
  }

  componentWillUnmount () {
    this.unpreventClosingTab();
  }

  routerWillLeave() {
    if (!this.state.isPristine) {
      return UNSAVED_CHANGES_WARNING;
    }
  }

  setStateFromSession(currentAccount, environment) {
    if (currentAccount.extra_details === undefined) {
      currentAccount.extra_details = {};
    }

    this.setState({
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

      languageChoices: environment.all_languages,
      countryChoices: environment.available_countries,
      sectorChoices: environment.available_sectors,
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
    });
  }

  /**
   * returns to where you came from
   */
  safeClose() {
    if (this.state.isPristine) {
      hashHistory.goBack();
    } else {
      let dialog = alertify.dialog('confirm');
      let opts = {
        title: UNSAVED_CHANGES_WARNING,
        message: '',
        labels: {ok: t('Yes, leave settings'), cancel: t('Cancel')},
        onok: () => {
          this.setState({isPristine: true});
          this.unpreventClosingTab();
          hashHistory.goBack();
        },
        oncancel: dialog.destroy
      };
      dialog.set(opts).show();
    }
  }

  preventClosingTab() {
    $(window).on('beforeunload.noclosetab', () => {
      return UNSAVED_CHANGES_WARNING;
    });
  }

  unpreventClosingTab() {
    $(window).off('beforeunload.noclosetab');
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

  onUpdateComplete() {
    this.unpreventClosingTab();
    this.setState({
      isPristine: true,
      fieldsErrors: {}
    });
  }

  onUpdateFail(data) {
    this.setState({fieldsErrors: data.responseJSON});
  }

  handleChange(evt, attr) {
    let val;
    if (evt && evt.target) {
      if (evt.target.type === 'checkbox') {
        val = evt.target.checked;
      } else {
        val = evt.target.value;
      }
    } else {
      // react-select, TextBox and Checkbox just passes a value
      val = evt;
    }
    this.preventClosingTab();
    this.setState({
      isPristine: false,
      [attr]: val
    });
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
  requireAuthChange (isChecked) {this.handleChange(isChecked, 'requireAuth');}
  twitterChange (e) {this.handleChange(e, 'twitter');}
  linkedinChange (e) {this.handleChange(e, 'linkedin');}
  instagramChange (e) {this.handleChange(e, 'instagram');}
  metadataChange (e) {this.handleChange(e, 'metadata');}

  render() {
    if(
      !stores.session.isLoggedIn ||
      !envStore.isReady
    ) {
      return (
        <bem.AccountSettings>
          <bem.AccountSettings__item>
            <LoadingSpinner/>
          </bem.AccountSettings__item>
        </bem.AccountSettings>
      );
    }

    var accountName = stores.session.currentAccount.username;
    var initialsStyle = {
      background: `#${stringToColor(accountName)}`
    };

    return (
      <DocumentTitle title={`${accountName} | KoboToolbox`}>
        <bem.AccountSettings>
          <bem.AccountSettings__actions>
            <bem.KoboButton
              onClick={this.updateProfile}
              m={['blue']}
            >
              {t('Save Changes')}
              {!this.state.isPristine && ' *'}
            </bem.KoboButton>

            <bem.Button
              onClick={this.safeClose}
              m='icon'
              className='account-settings-close'
            >
              <i className='k-icon k-icon-close'/>
            </bem.Button>
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
                <bem.AccountSettings__item>
                  <label htmlFor='requireAuth'>{t('Privacy')}</label>
                </bem.AccountSettings__item>

                <Checkbox
                  id='requireAuth'
                  checked={this.state.requireAuth}
                  onChange={this.requireAuthChange}
                  label={t('Require authentication to see forms and submit data')}
                />
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
                  href={`/#${ROUTES.CHANGE_PASSWORD}`}
                  className='kobo-button kobo-button--teal'
                >
                  {t('Modify Password')}
                </a>
              </bem.AccountSettings__item>

              <ApiTokenDisplay/>

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
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='primary-sector'>
                <label>
                  {t('Primary Sector')}

                  <Select
                    value={this.state.primarySector}
                    options={this.state.sectorChoices}
                    onChange={this.primarySectorChange}
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    menuPlacement='auto'
                  />
                </label>

                <bem.AccountSettings__desc>
                  {t('Select the primary sector in which you work. ')}
                </bem.AccountSettings__desc>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='gender'>
                <label>
                  {t('Gender')}

                  <Select
                    value={this.state.gender}
                    options={this.state.genderChoices}
                    onChange={this.genderChange}
                    isSearchable={false}
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    menuPlacement='auto'
                  />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='bio'>
                <label>
                  {t('Bio')}

                  <TextareaAutosize
                    onChange={this.bioChange}
                    value={this.state.bio}
                    id='bio'
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
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    menuPlacement='auto'
                  />
                </label>
              </bem.AccountSettings__item>

              <bem.AccountSettings__item m='social'>
                <label>{t('Social')}</label>

                <label>
                  <i className='k-icon k-icon-logo-twitter' />

                  <input
                    type='text'
                    value={this.state.twitter}
                    onChange={this.twitterChange}
                  />
                </label>

                <label>
                  <i className='k-icon k-icon-logo-linkedin' />

                  <input
                    type='text'
                    value={this.state.linkedin}
                    onChange={this.linkedinChange}
                  />
                </label>

                <label>
                  <i className='k-icon k-icon-logo-instagram' />

                  <input
                    type='text'
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
      </DocumentTitle>
    );
  }
}

reactMixin(AccountSettings.prototype, Reflux.connect(stores.session, 'session'));
reactMixin(AccountSettings.prototype, Reflux.ListenerMixin);
