import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import { Link } from 'react-router';
import {bem} from '../bem';
import {dataInterface} from '../dataInterface';
import {stores} from '../stores';
import ui from '../ui';
import mixins from '../mixins';
import {actions} from '../actions';
import DocumentTitle from 'react-document-title';
import CopyToClipboard from 'react-copy-to-clipboard';
import {MODAL_TYPES} from '../constants';
import {
  formatTime,
  notify
} from 'utils';

const DVCOUNT_LIMIT_MINIMUM = 20;

export class FormLanding extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      selectedCollectMethod: 'offline_url',
      DVCOUNT_LIMIT: DVCOUNT_LIMIT_MINIMUM,
      nextPageUrl: null,
      nextPagesVersions: []
    };
    autoBind(this);
  }
  componentDidMount () {
    // reset loaded versions when new one is deployed
    this.listenTo(actions.resources.deployAsset.completed, this.resetLoadedVersions);
  }
  resetLoadedVersions() {
    this.setState({
      DVCOUNT_LIMIT: DVCOUNT_LIMIT_MINIMUM,
      nextPageUrl: null,
      nextPagesVersions: []
    });
  }
  enketoPreviewModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.ENKETO_PREVIEW,
      assetid: this.state.uid
    });
  }
  callUnarchiveAsset() {
    this.unarchiveAsset();
  }
  renderFormInfo (userCanEdit) {
    var dvcount = this.state.deployed_versions.count;
    var undeployedVersion;
    if (!this.isCurrentVersionDeployed()) {
      undeployedVersion = `(${t('undeployed')})`;
      dvcount = dvcount + 1;
    }
    return (
        <bem.FormView__cell m={['columns', 'padding']}>
          <bem.FormView__cell>
            <bem.FormView__cell m='version'>
              {dvcount > 0 ? `v${dvcount}` : ''}
            </bem.FormView__cell>
            {undeployedVersion && userCanEdit &&
              <bem.FormView__cell m='undeployed'>
                &nbsp;{undeployedVersion}
              </bem.FormView__cell>
            }
            <bem.FormView__cell m='date'>
              {t('Last Modified')}&nbsp;:&nbsp;
              {formatTime(this.state.date_modified)}&nbsp;-&nbsp;
              <span className='question-count'>
                {this.state.summary.row_count || '0'}&nbsp;
                {t('questions')}
                </span>
            </bem.FormView__cell>
          </bem.FormView__cell>
          <bem.FormView__cell m='buttons'>
            {userCanEdit && this.state.has_deployment && this.state.deployment__active &&
              <a
                className='kobo-button kobo-button--blue'
                onClick={this.deployAsset}>
                  {t('redeploy')}
              </a>
            }
            {userCanEdit && !this.state.has_deployment && !this.state.deployment__active &&
              <a
                className='kobo-button kobo-button--blue'
                onClick={this.deployAsset}>
                  {t('deploy')}
              </a>
            }
            {userCanEdit && this.state.has_deployment && !this.state.deployment__active &&
              <a
                className='kobo-button kobo-button--blue'
                onClick={this.callUnarchiveAsset}>
                  {t('unarchive')}
              </a>
            }
          </bem.FormView__cell>
        </bem.FormView__cell>
      );
  }
  showSharingModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.SHARING,
      assetid: this.state.uid
    });
  }
  showReplaceProjectModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.REPLACE_PROJECT,
      asset: this.state
    });
  }
  isCurrentVersionDeployed() {
    if (
      this.state.deployment__active &&
      this.state.deployed_versions.count > 0 &&
      this.state.deployed_version_id
    ) {
      const deployed_version = this.state.deployed_versions.results.find(
        (version) => {return version.uid === this.state.deployed_version_id;}
      );
      return deployed_version.content_hash === this.state.version__content_hash;
    }
    return false;
  }
  isFormRedeploymentNeeded() {
    return !this.isCurrentVersionDeployed() && this.userCan('change_asset', this.state);
  }
  hasLanguagesDefined(translations) {
    return translations && (translations.length > 1 || translations[0] !== null);
  }
  showLanguagesModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.FORM_LANGUAGES,
      asset: this.state
    });
  }
  showEncryptionModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.ENCRYPT_FORM,
      asset: this.state
    });
  }
  loadMoreVersions() {
    if (this.state.DVCOUNT_LIMIT + DVCOUNT_LIMIT_MINIMUM <= this.state.deployed_versions.count + DVCOUNT_LIMIT_MINIMUM) {
      this.setState({ DVCOUNT_LIMIT: this.state.DVCOUNT_LIMIT + DVCOUNT_LIMIT_MINIMUM });
    }
    let urlToLoad = null;
    if(this.state.nextPageUrl) {
      urlToLoad = this.state.nextPageUrl;
    } else if (this.state.deployed_versions.next) {
      urlToLoad = this.state.deployed_versions.next;
    }
    if (urlToLoad !== null) {
      dataInterface.loadNextPageUrl(urlToLoad).done((data) => {
        this.setState({nextPageUrl: data.deployed_versions.next});
        const newNextPagesVersions = this.state.nextPagesVersions;
        Object.values(data.deployed_versions.results).forEach((item) => {
          newNextPagesVersions.push(item);
        });
        this.setState({nextPagesVersions: newNextPagesVersions});
      });
    }
  }
  renderHistory () {
    var dvcount = this.state.deployed_versions.count;
    const versionsToDisplay = this.state.deployed_versions.results.concat(
      this.state.nextPagesVersions
    );
    return (
      <bem.FormView__row className={this.state.historyExpanded ? 'historyExpanded' : 'historyHidden'}>
        <bem.FormView__cell m={['columns', 'label', 'first', 'history-label']}>
          <bem.FormView__cell m='label'>
            {t('Form history')}
          </bem.FormView__cell>
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'history-table']}>
          <bem.FormView__group m='deployments'>
            <bem.FormView__group m={['items', 'headings']}>
              <bem.FormView__label m='version'>{t('Version')}</bem.FormView__label>
              <bem.FormView__label m='date'>{t('Last Modified')}</bem.FormView__label>
              <bem.FormView__label m='clone'>{t('Clone')}</bem.FormView__label>
            </bem.FormView__group>
            {versionsToDisplay.map((item, n) => {
              if (dvcount - n > 0) {
                return (
                  <bem.FormView__group m='items' key={n} className={n >= this.state.DVCOUNT_LIMIT ? 'hidden' : ''} >
                    <bem.FormView__label m='version'>
                      {`v${dvcount - n}`}
                      {item.uid === this.state.deployed_version_id && this.state.deployment__active &&
                        <bem.FormView__cell m='deployed'>
                          {t('Deployed')}
                        </bem.FormView__cell>
                      }
                    </bem.FormView__label>
                    <bem.FormView__label m='date'>
                      {formatTime(item.date_deployed)}
                    </bem.FormView__label>
                    <bem.FormView__label m='clone' className='right-tooltip'>
                        <bem.FormView__link m='clone'
                            data-version-id={item.uid}
                            data-tip={t('Clone this version as a new project')}
                            onClick={this.saveCloneAs}>
                          <i className='k-icon-clone' />
                        </bem.FormView__link>
                    </bem.FormView__label>
                  </bem.FormView__group>
                );
              }
            })}
          </bem.FormView__group>
        </bem.FormView__cell>
        {this.state.deployed_versions.count > 1 &&
          <bem.FormView__cell m={['centered']}>
            <bem.Button m='colored' onClick={this.toggleDeploymentHistory}>
              {this.state.historyExpanded ? t('Hide full history') : t('Show full history')}
            </bem.Button>
            {(this.state.historyExpanded && this.state.DVCOUNT_LIMIT < dvcount) &&
              <bem.Button m='colored' onClick={this.loadMoreVersions}>
                {t('Load more')}
              </bem.Button>
            }
          </bem.FormView__cell>
        }
      </bem.FormView__row>
    );
  }
  renderCollectData () {
    var available_links = new Map([
        ['offline_url', {
          label: t('Online-Offline (multiple submission)'),
          desc: t('This allows online and offline submissions and is the best option for collecting data in the field. ')
        }],
        ['url', {
          label: t('Online-Only (multiple submissions)'),
          desc: t('This is the best option when entering many records at once on a computer, e.g. for transcribing paper records.')
        }],
        ['single_url', {
          label: t('Online-Only (single submission)'),
          desc: t('This allows a single submission, and can be paired with the "return_url" parameter to redirect the user to a URL of your choice after the form has been submitted.')
        }],
        ['single_once_url', {
          label: t('Online-only (once per respondent)'),
          desc: t('This allows your web form to only be submitted once per user, using basic protection to prevent the same user (on the same browser & device) from submitting more than once.')
        }],
        ['iframe_url', {
          label: t('Embeddable web form code'),
          desc: t('Use this html5 code snippet to integrate your form on your own website using smaller margins. ')
        }],
        ['preview_url', {
          label: t('View only'),
          desc: t('Use this version for testing, getting feedback. Does not allow submitting data. ')
        }],
        ['android', {
          label: t('Android application'),
          desc: t('Use this option to collect data in the field with your Android device.')
        }],
    ]);

    var deployment__links_list = [];
    available_links.forEach(function (value, key) {
      deployment__links_list.push(
        {
          key: key,
          label: value.label,
          desc: value.desc,
        }
      );
    });

    var chosenMethod = this.state.selectedCollectMethod;

    var kc_server = document.createElement('a');
    kc_server.href = this.state.deployment__identifier;
    var kobocollect_url = kc_server.origin;

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['label', 'first']}>
            {t('Collect data')}
        </bem.FormView__cell>
        <bem.FormView__cell m='box'>
          <bem.FormView__cell m={['columns', 'padding']}>
            <bem.FormView__cell>
              <ui.PopoverMenu type='collectData-menu' triggerLabel={available_links.get(chosenMethod).label}>
                {deployment__links_list.map((c) => {
                  return (
                    <bem.PopoverMenu__link
                      m={['collect-row']}
                      key={`c-${c.key}`}
                      data-method={c.key}
                      onClick={this.setCollectMethod}
                    >
                      <div className='collect-data-label'>{c.label}</div>
                      <div className='collect-data-desc'>{c.desc}</div>
                    </bem.PopoverMenu__link>
                  );
                })}
              </ui.PopoverMenu>
            </bem.FormView__cell>
            <bem.FormView__cell>
              {chosenMethod !== 'iframe_url' && chosenMethod !== 'android' &&
               this.state.deployment__links[chosenMethod] &&
                <CopyToClipboard text={this.state.deployment__links[chosenMethod]}
                  onCopy={() => notify(t('copied to clipboard'))}
                  options={{format: 'text/plain'}}
                >
                  <button className='copy mdl-button mdl-button--colored'>
                    {t('Copy')}
                  </button>
                </CopyToClipboard>
              }
              {chosenMethod !== 'iframe_url' && chosenMethod !== 'android' &&
                <a className='collect-link mdl-button mdl-button--colored'
                  target='_blank'
                  href={this.state.deployment__links[chosenMethod]}>
                  {t('Open')}
                </a>
              }
              { chosenMethod === 'android' &&
                <a className='collect-link mdl-button mdl-button--colored'
                  target='_blank'
                  href='https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en'>
                  {t('Download KoboCollect')}
                </a>
              }
              {chosenMethod === 'iframe_url' &&
                <CopyToClipboard
                  text={`<iframe src=${this.state.deployment__links[chosenMethod]} width="800" height="600"></iframe>`}
                  onCopy={() => notify(t('copied to clipboard'))}
                  options={{format: 'text/plain'}}
                >
                  <button className='copy mdl-button mdl-button--colored'>
                    {t('Copy')}
                  </button>
                </CopyToClipboard>
              }
            </bem.FormView__cell>
          </bem.FormView__cell>
          <bem.FormView__cell m={['padding', 'bordertop', 'collect-meta']}>
            {chosenMethod !== 'android' &&
              available_links.get(chosenMethod).desc
            }

            {chosenMethod === 'iframe_url' &&
              <pre>
                {`<iframe src="${this.state.deployment__links[chosenMethod]}" width="800" height="600"></iframe>`}
              </pre>
            }

            {chosenMethod === 'android' &&
              <ol>
                <li>
                  {t('Install')}
                  &nbsp;
                  <a href='https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en' target='_blank'>KoboCollect</a>
                  &nbsp;
                  {t('on your Android device.')}
                </li>
                <li>{t('Click on')} <i className='k-icon k-icon-more-vertical'/> {t('to open settings.')}</li>
                <li>
                  {t('Enter the server URL')}&nbsp;
                  <code>{kobocollect_url}</code>&nbsp;
                  {t('and your username and password')}
                </li>
                <li>{t('Open "Get Blank Form" and select this project. ')}</li>
                <li>{t('Open "Enter Data."')}</li>
              </ol>
            }

          </bem.FormView__cell>
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }
  setCollectMethod(evt) {
    this.setState({selectedCollectMethod: evt.currentTarget.dataset.method});
  }
  renderButtons (userCanEdit) {
    var downloads = [];
    if (this.state.downloads) {
      downloads = this.state.downloads;
    }

    return (
      <React.Fragment>
        {userCanEdit ?
          <Link to={`/forms/${this.state.uid}/edit`}
                className='form-view__link form-view__link--edit'
                data-tip={t('Edit in Form Builder')}>
            <i className='k-icon-edit' />
          </Link>
        :
          <bem.FormView__link m={['edit', 'disabled']}
            className='right-tooltip'
            data-tip={t('Editing capabilities not granted, you can only view this form')}>
            <i className='k-icon-edit' />
          </bem.FormView__link>
        }

        <bem.FormView__link m='preview'
          onClick={this.enketoPreviewModal}
          data-tip={t('Preview')}>
          <i className='k-icon-view' />
        </bem.FormView__link>

        {userCanEdit &&
          <bem.FormView__link
            m='upload'
            data-tip={t('Replace form')}
            onClick={this.showReplaceProjectModal}
          >
            <i className='k-icon-replace' />
          </bem.FormView__link>
        }

        <ui.PopoverMenu
          type='formLanding-menu'
          triggerLabel={<i className='k-icon-more' />}
          triggerTip={t('More Actions')}
        >
          {downloads.map((dl) => {
            return (
                <bem.PopoverMenu__link m={`dl-${dl.format}`} href={dl.url}
                    key={`dl-${dl.format}`}>
                  <i className={`k-icon-${dl.format}-file`}/>
                  {t('Download')}&nbsp;
                  {dl.format.toString().toUpperCase()}
                </bem.PopoverMenu__link>
              );
          })}

          {userCanEdit &&
            <bem.PopoverMenu__link onClick={this.showSharingModal}>
              <i className='k-icon-user-share'/>
              {t('Share this project')}
            </bem.PopoverMenu__link>
          }

          <bem.PopoverMenu__link onClick={this.saveCloneAs}>
            <i className='k-icon-clone'/>
            {t('Clone this project')}
          </bem.PopoverMenu__link>

          <bem.PopoverMenu__link
            onClick={this.cloneAsTemplate}
            data-asset-uid={this.state.uid}
            data-asset-name={this.state.name}
          >
            <i className='k-icon-template'/>
            {t('Create template')}
          </bem.PopoverMenu__link>

          {userCanEdit && this.state.content.survey.length > 0 &&
            <bem.PopoverMenu__link onClick={this.showLanguagesModal}>
              <i className='k-icon-language'/>
              {t('Manage Translations')}
            </bem.PopoverMenu__link>
          }
          { /* temporarily disabled
          <bem.PopoverMenu__link onClick={this.showEncryptionModal}>
            <i className='k-icon-lock'/>
            {t('Manage Encryption')}
          </bem.PopoverMenu__link>
          */ }
        </ui.PopoverMenu>
      </React.Fragment>
    );
  }
  renderLanguages (canEdit) {
    let translations = this.state.content.translations;

    return (
      <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
        <bem.FormView__cell m='translation-list'>
          <strong>{t('Languages:')}</strong>
          &nbsp;
          {!this.hasLanguagesDefined(translations) &&
            t('This project has no languages defined yet')
          }
          {this.hasLanguagesDefined(translations) &&
            <ul>
              {translations.map((langString, n) => {
                return (
                  <li key={n}>
                    {langString || t('Unnamed language')}
                  </li>
                );
              })}
            </ul>
          }
        </bem.FormView__cell>

        {canEdit &&
          <bem.FormView__cell>
            <bem.FormView__link
              data-tip={t('Manage Translations')}
              onClick={this.showLanguagesModal}>
              <i className='k-icon-language' />
            </bem.FormView__link>
          </bem.FormView__cell>
        }
      </bem.FormView__cell>
    );
  }
  render () {
    var docTitle = this.state.name || t('Untitled');
    const userCanEdit = this.userCan('change_asset', this.state);

    if (this.state.uid === undefined) {
      return (<ui.LoadingSpinner/>);
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='form'>
          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m='label'>
                {this.state.deployment__active ? t('Current version') :
                  this.state.has_deployment ? t('Archived version') :
                    t('Draft version')}
              </bem.FormView__cell>
              <bem.FormView__cell m='action-buttons'>
                {this.renderButtons(userCanEdit)}
              </bem.FormView__cell>
            </bem.FormView__cell>
            <bem.FormView__cell m='box'>
              {this.isFormRedeploymentNeeded() &&
                <bem.FormView__cell m='warning'>
                  <i className='k-icon-alert' />
                  <p>{t('If you want to make these changes public, you must deploy this form.')}</p>
                </bem.FormView__cell>
              }
              {this.renderFormInfo(userCanEdit)}
              {this.renderLanguages(userCanEdit)}
            </bem.FormView__cell>
          </bem.FormView__row>
          {this.state.deployed_versions.count > 0 &&
            this.renderHistory()
          }
          {this.state.deployed_versions.count > 0 && this.state.deployment__active &&
            this.renderCollectData()
          }
        </bem.FormView>
      </DocumentTitle>
      );
  }
}

reactMixin(FormLanding.prototype, mixins.permissions);
reactMixin(FormLanding.prototype, mixins.dmix);
reactMixin(FormLanding.prototype, Reflux.ListenerMixin);

FormLanding.contextTypes = {
  router: PropTypes.object
};

export default FormLanding;
