import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import bem from 'js/bem';
import {dataInterface} from 'js/dataInterface';
import sessionStore from 'js/stores/session';
import PopoverMenu from 'js/popoverMenu';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import InlineMessage from 'js/components/common/inlineMessage';
import CollectMethodSelector from 'js/project/collectMethodSelector.component';
import mixins from 'js/mixins';
import {actions} from 'js/actions';
import DocumentTitle from 'react-document-title';
import CopyToClipboard from 'react-copy-to-clipboard';
import {MODAL_TYPES, COLLECTION_METHODS} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import {formatTime, notify} from 'utils';
import {buildUserUrl, ANON_USERNAME} from 'js/users/utils';
import {Link} from 'react-router-dom';
import {withRouter} from 'js/router/legacy';
import envStore from 'js/envStore';
import {
  userCan,
  userCanRemoveSharedProject,
} from 'js/components/permissions/utils';
import permConfig from 'js/components/permissions/permConfig';
import {PERMISSIONS_CODENAMES} from 'js/components/permissions/permConstants';
import {HELP_ARTICLE_ANON_SUBMISSIONS_URL} from 'js/constants';
import AnonymousSubmission from 'js/components/anonymousSubmission.component';
import NewFeatureDialog from 'js/components/newFeatureDialog.component';
import pageState from 'js/pageState.store';
import Button from 'js/components/common/button';

const DVCOUNT_LIMIT_MINIMUM = 20;
const ANON_CAN_ADD_PERM_URL = permConfig.getPermissionByCodename(
  PERMISSIONS_CODENAMES.add_submissions
).url;

class FormLanding extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedCollectMethod: COLLECTION_METHODS.offline_url.id,
      DVCOUNT_LIMIT: DVCOUNT_LIMIT_MINIMUM,
      nextPageUrl: null,
      nextPagesVersions: [],
      anonymousSubmissions: false,
      anonymousPermissions: [],
    };
    autoBind(this);
  }
  componentDidMount() {
    // reset loaded versions when new one is deployed
    this.listenTo(
      actions.resources.deployAsset.completed,
      this.resetLoadedVersions
    );
    this.listenTo(
      actions.permissions.getAssetPermissions.completed,
      this.onAssetPermissionsUpdated
    );
    this.listenTo(
      actions.resources.loadAsset.completed,
      this.onAssetPermissionsUpdated
    );

    actions.resources.loadAsset({id: this.props.params.uid});
  }

  onAssetPermissionsUpdated(res) {
    let response = res;
    if (response.permissions) {
      response = res.permissions;
    }
    const publicPerms = response.filter(
      (assignment) => assignment.user === buildUserUrl(ANON_USERNAME)
    );
    const anonCanAdd = publicPerms.filter(
      (perm) => perm.permission === ANON_CAN_ADD_PERM_URL
    )[0];
    this.setState({
      anonymousPermissions: publicPerms,
      anonymousSubmissions: Boolean(anonCanAdd),
    });
  }
  updateAssetAnonymousSubmissions() {
    const permission = this.state.anonymousPermissions.find(
      (perm) =>
        perm.permission ===
        permConfig.getPermissionByCodename(
          PERMISSIONS_CODENAMES.add_submissions
        ).url
    );
    if (this.state.anonymousSubmissions) {
      actions.permissions.removeAssetPermission(
        this.props.params.uid,
        permission.url
      );
    } else {
      actions.permissions.assignAssetPermission(this.props.params.uid, {
        user: buildUserUrl(ANON_USERNAME),
        permission: ANON_CAN_ADD_PERM_URL,
      });
    }
  }
  resetLoadedVersions() {
    this.setState({
      DVCOUNT_LIMIT: DVCOUNT_LIMIT_MINIMUM,
      nextPageUrl: null,
      nextPagesVersions: [],
    });
  }
  enketoPreviewModal(evt) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.ENKETO_PREVIEW,
      assetid: this.state.uid,
    });
  }
  callUnarchiveAsset() {
    this.unarchiveAsset();
  }
  renderFormInfo(userCanEdit) {
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
          {undeployedVersion && userCanEdit && (
            <bem.FormView__cell m='undeployed'>
              &nbsp;{undeployedVersion}
            </bem.FormView__cell>
          )}
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
          {userCanEdit && this.state.deployment_status === 'deployed' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={this.deployAsset.bind(this)}
              label={t('redeploy')}
            />
          )}
          {userCanEdit && this.state.deployment_status === 'draft' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={this.deployAsset.bind(this)}
              label={t('deploy')}
            />
          )}
          {userCanEdit && this.state.deployment_status === 'archived' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={this.callUnarchiveAsset.bind(this)}
              label={t('unarchive')}
            />
          )}
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
  showSharingModal(evt) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.SHARING,
      assetid: this.state.uid,
    });
  }
  showReplaceProjectModal(evt) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.REPLACE_PROJECT,
      asset: this.state,
    });
  }
  isCurrentVersionDeployed() {
    if (
      this.state.deployment__active &&
      this.state.deployed_versions.count > 0 &&
      this.state.deployed_version_id
    ) {
      const deployed_version = this.state.deployed_versions.results.find(
        (version) => {
          return version.uid === this.state.deployed_version_id;
        }
      );
      return deployed_version.content_hash === this.state.version__content_hash;
    }
    return false;
  }
  isFormRedeploymentNeeded() {
    return (
      !this.isCurrentVersionDeployed() && userCan('change_asset', this.state)
    );
  }
  hasLanguagesDefined(translations) {
    return (
      translations && (translations.length > 1 || translations[0] !== null)
    );
  }
  showLanguagesModal(evt) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.FORM_LANGUAGES,
      asset: this.state,
    });
  }
  showEncryptionModal(evt) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.ENCRYPT_FORM,
      asset: this.state,
    });
  }
  loadMoreVersions() {
    if (
      this.state.DVCOUNT_LIMIT + DVCOUNT_LIMIT_MINIMUM <=
      this.state.deployed_versions.count + DVCOUNT_LIMIT_MINIMUM
    ) {
      this.setState({
        DVCOUNT_LIMIT: this.state.DVCOUNT_LIMIT + DVCOUNT_LIMIT_MINIMUM,
      });
    }
    let urlToLoad = null;
    if (this.state.nextPageUrl) {
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

  renderHistory() {
    var dvcount = this.state.deployed_versions.count;
    const versionsToDisplay = this.state.deployed_versions.results.concat(
      this.state.nextPagesVersions
    );
    const isLoggedIn = sessionStore.isLoggedIn;
    return (
      <bem.FormView__row
        className={
          this.state.historyExpanded ? 'historyExpanded' : 'historyHidden'
        }
      >
        <bem.FormView__cell m={['columns', 'label', 'first', 'history-label']}>
          <bem.FormView__cell m='label'>{t('Form history')}</bem.FormView__cell>
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'history-table']}>
          <bem.FormView__group m='deployments'>
            <bem.FormView__group m={['items', 'headings']}>
              <bem.FormView__label m='version'>
                {t('Version')}
              </bem.FormView__label>
              <bem.FormView__label m='date'>
                {t('Last Modified')}
              </bem.FormView__label>
              {isLoggedIn && (
                <bem.FormView__label m='clone'>
                  {t('Clone')}
                </bem.FormView__label>
              )}
            </bem.FormView__group>
            {versionsToDisplay.map((item, n) => {
              if (dvcount - n > 0) {
                return (
                  <bem.FormView__group
                    m='items'
                    key={n}
                    className={n >= this.state.DVCOUNT_LIMIT ? 'hidden' : ''}
                  >
                    <bem.FormView__label m='version'>
                      {`v${dvcount - n}`}
                      {item.uid === this.state.deployed_version_id &&
                        this.state.deployment__active && (
                          <bem.FormView__cell m='deployed'>
                            {t('Deployed')}
                          </bem.FormView__cell>
                        )}
                    </bem.FormView__label>
                    <bem.FormView__label m='date'>
                      {formatTime(item.date_deployed)}
                    </bem.FormView__label>
                    {isLoggedIn && (
                      <Button
                        type='text'
                        size='m'
                        onClick={() => {this.saveCloneAs(item.uid);}}
                        startIcon='duplicate'
                        tooltip={t('Clone this version as a new project')}
                        tooltipPosition='right'
                      />
                    )}
                  </bem.FormView__group>
                );
              }
            })}
          </bem.FormView__group>
        </bem.FormView__cell>
        {this.state.deployed_versions.count > 1 && (
          <bem.FormView__cell m={['centered']}>
            <Button
              type='text'
              size='m'
              startIcon={this.state.historyExpanded ? 'angle-up' : 'angle-down'}
              onClick={this.toggleDeploymentHistory.bind(this)}
              label={this.state.historyExpanded ? t('Hide full history') : t('Show full history')}
            />

            {this.state.historyExpanded &&
              this.state.DVCOUNT_LIMIT < dvcount && (
                <Button
                  type='text'
                  size='m'
                  onClick={this.loadMoreVersions.bind(this)}
                  label={t('Load more')}
                />
              )}
          </bem.FormView__cell>
        )}
      </bem.FormView__row>
    );
  }
  renderCollectData() {
    const deployment__links_list = [];
    Object.keys(COLLECTION_METHODS).forEach((methodId) => {
      const methodDef = COLLECTION_METHODS[methodId];
      deployment__links_list.push({
        key: methodDef.id,
        label: methodDef.label,
        desc: methodDef.desc,
      });
    });

    const chosenMethod = this.state.selectedCollectMethod;
    const chosenMethodLink = this.state.deployment__links[chosenMethod] || null;

    var kc_server = document.createElement('a');
    kc_server.href = envStore.data.open_rosa_server;
    var kobocollect_url = kc_server.origin;

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['label', 'first']}>
          {t('Collect data')}
        </bem.FormView__cell>
        <bem.FormView__cell m='box'>
          <bem.FormView__cell m={['columns', 'padding', 'collect-header']}>
            <bem.FormView__cell>
              <CollectMethodSelector
                onChange={(newMethod) => {this.setCollectMethod(newMethod);}}
                selectedMethod={chosenMethod}
              />
            </bem.FormView__cell>

            <bem.FormView__cell className='collect-header-actions'>
              {this.renderCollectLink()}
            </bem.FormView__cell>
          </bem.FormView__cell>

          <bem.FormView__cell m={['small-padding', 'collect-meta']}>
            {chosenMethod !== COLLECTION_METHODS.android.id &&
              COLLECTION_METHODS[chosenMethod].desc}

            {chosenMethod === COLLECTION_METHODS.iframe_url.id && (
              <pre>
                {`<iframe src="${chosenMethodLink}" width="800" height="600"></iframe>`}
              </pre>
            )}

            {chosenMethod === COLLECTION_METHODS.android.id && (
              <ol>
                <li>
                  {t('Install')}
                  &nbsp;
                  <a
                    href='https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en'
                    target='_blank'
                  >
                    KoboCollect
                  </a>
                  &nbsp;
                  {t('on your Android device.')}
                </li>
                <li>
                  {t('Click on')} <i className='k-icon k-icon-more-vertical' />{' '}
                  {t('to open settings.')}
                </li>
                <li>
                  {t('Enter the server URL')}&nbsp;
                  <code>{kobocollect_url}</code>&nbsp;
                  {t('and your username and password')}
                </li>
                <li>{t('Open "Get Blank Form" and select this project. ')}</li>
                <li>{t('Open "Enter Data."')}</li>
              </ol>
            )}
          </bem.FormView__cell>

          {userCan('change_asset', this.state) && (
            <bem.FormView__cell
              m={['padding', 'anonymous-submissions', 'bordertop']}
            >
              <NewFeatureDialog
                content={t(
                  'You can now control whether to allow anonymous submissions for each project. Previously, this was an account-wide setting.'
                )}
                supportArticle={
                  envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL
                }
                featureKey='anonymousSubmissions'
                disabled={pageState.state?.modal}
                pointerClass='anonymousSubmissionPointer'
                dialogClass='anonymousSubmissionDialog'
              >
                <AnonymousSubmission
                  checked={this.state.anonymousSubmissions}
                  onChange={() => this.updateAssetAnonymousSubmissions()}
                />
              </NewFeatureDialog>
            </bem.FormView__cell>
          )}
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }

  renderCollectLink() {
    const chosenMethod = this.state.selectedCollectMethod;
    const chosenMethodLink = this.state.deployment__links[chosenMethod] || null;

    if (chosenMethod === COLLECTION_METHODS.android.id) {
      return (
        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.open(COLLECTION_METHODS.android.url, '_blank');
          }}
          label={t('Download KoboCollect')}
        />
      );
    }

    if (chosenMethodLink === null) {
      return (
        <span
          className='collect-link-missing right-tooltip'
          data-tip={t(
            "Try reloading the page, if problem doesn't go away, contact support."
          )}
        >
          <i className='k-icon k-icon-alert' />
          {t('Link missing')}
        </span>
      );
    }

    if (chosenMethod === COLLECTION_METHODS.iframe_url.id) {
      return (
        <CopyToClipboard
          text={`<iframe src=${chosenMethodLink} width="800" height="600"></iframe>`}
          onCopy={() => {
            notify(t('Copied to clipboard'));
          }}
          options={{format: 'text/plain'}}
        >
          <Button
            type='secondary'
            size='m'
            label={t('Copy')}
          />
        </CopyToClipboard>
      );
    }

    return (
      <React.Fragment>
        <CopyToClipboard
          text={chosenMethodLink}
          onCopy={() => {
            notify(t('Copied to clipboard'));
          }}
          options={{format: 'text/plain'}}
        >
          <Button
            type='secondary'
            size='m'
            label={t('Copy')}
          />
        </CopyToClipboard>

        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.open(chosenMethodLink, '_blank');
          }}
          label={t('Open')}
        />
      </React.Fragment>
    );
  }

  setCollectMethod(newMethod) {
    this.setState({selectedCollectMethod: newMethod});
  }

  goToProjectsList() {
    this.props.router.navigate(ROUTES.FORMS);
  }
  nonOwnerSelfRemoval(evt) {
    evt.preventDefault();
    // Listen for permission removal here to avoid manage_asset user removal
    // from triggering redirect
    this.nonOwnerSelfRemovalListener = this.listenTo(
      actions.permissions.removeAssetPermission.completed,
      this.nonOwnerSelfRemovalCompleted
    );
    this.removeSharing();
  }
  nonOwnerSelfRemovalCompleted() {
    // Remove listener after self removal
    if (this.nonOwnerSelfRemovalListener) {
      this.stopListeningTo(actions.permissions.removeAssetPermission.completed);
    }
    this.goToProjectsList();
  }
  renderButtons(userCanEdit) {
    var downloads = [];
    if (this.state.downloads) {
      downloads = this.state.downloads;
    }

    const isLoggedIn = sessionStore.isLoggedIn;

    return (
      <React.Fragment>
        {userCanEdit ? (
          <Link to={`/forms/${this.state.uid}/edit`}>
            {/*
              We put non clickable button inside Link, so that it's possible
              to open it in new tab.
            */}
            <Button
              type='text'
              size='m'
              startIcon='edit'
              data-cy='edit'
              tooltip={t('Edit in Form Builder')}
              tooltipPosition='right'
            />
          </Link>
        ) : (
          <Button
            type='text'
            size='m'
            startIcon='edit'
            tooltip={t('Editing capabilities not granted, you can only view this form')}
            tooltipPosition='right'
            isDisabled
          />
        )}

        <Button
          type='text'
          size='m'
          startIcon='view'
          tooltip={t('Preview')}
          tooltipPosition='right'
          onClick={this.enketoPreviewModal.bind(this)}
        />

        {userCanEdit && (
          <Button
            type='text'
            size='m'
            startIcon='replace'
            tooltip={t('Replace form')}
            tooltipPosition='right'
            onClick={this.showReplaceProjectModal.bind(this)}
          />
        )}

        <PopoverMenu
          type='formLanding-menu'
          triggerLabel={
            <Button
              type='text'
              size='m'
              startIcon='more'
              tooltip={t('More actions')}
              tooltipPosition='right'
            />
          }
        >
          {downloads.map((dl) =>
            (
              <bem.PopoverMenu__link
                m={`dl-${dl.format}`}
                href={dl.url}
                key={`dl-${dl.format}`}
              >
                <i className={`k-icon k-icon-file-${dl.format}`} />
                {t('Download')}&nbsp;
                {dl.format.toString().toUpperCase()}
              </bem.PopoverMenu__link>
            )
          )}

          {userCanEdit && (
            <bem.PopoverMenu__link onClick={this.showSharingModal}>
              <i className='k-icon k-icon-user-share' />
              {t('Share this project')}
            </bem.PopoverMenu__link>
          )}

          {isLoggedIn && userCanRemoveSharedProject(this.state) && (
            <bem.PopoverMenu__link onClick={this.nonOwnerSelfRemoval}>
              <i className='k-icon k-icon-trash' />
              {t('Remove shared project')}
            </bem.PopoverMenu__link>
          )}

          {isLoggedIn && (
            <bem.PopoverMenu__link onClick={() => this.saveCloneAs()}>
              <i className='k-icon k-icon-duplicate' />
              {t('Clone this project')}
            </bem.PopoverMenu__link>
          )}

          {isLoggedIn && (
            <bem.PopoverMenu__link
              onClick={this.cloneAsTemplate}
              data-asset-uid={this.state.uid}
              data-asset-name={this.state.name}
            >
              <i className='k-icon k-icon-template' />
              {t('Create template')}
            </bem.PopoverMenu__link>
          )}

          {userCanEdit && this.state.content.survey.length > 0 && (
            <bem.PopoverMenu__link onClick={this.showLanguagesModal}>
              <i className='k-icon k-icon-language' />
              {t('Manage translations')}
            </bem.PopoverMenu__link>
          )}
          {/* temporarily disabled
          <bem.PopoverMenu__link onClick={this.showEncryptionModal}>
            <i className='k-icon k-icon-lock'/>
            {t('Manage Encryption')}
          </bem.PopoverMenu__link>
          */}
        </PopoverMenu>
      </React.Fragment>
    );
  }
  renderLanguages(canEdit) {
    let translations = this.state.content.translations;

    return (
      <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
        <bem.FormView__cell m='translation-list'>
          <strong>{t('Languages:')}</strong>
          &nbsp;
          {!this.hasLanguagesDefined(translations) &&
            t('This project has no languages defined yet')}
          {this.hasLanguagesDefined(translations) && (
            <ul>
              {translations.map((langString, n) =>
                <li key={n}>{langString || t('Unnamed language')}</li>
              )}
            </ul>
          )}
        </bem.FormView__cell>

        {canEdit && (
          <bem.FormView__cell>
            <Button
              type='text'
              size='m'
              startIcon='language'
              tooltip={t('Manage translations')}
              tooltipPosition='right'
              onClick={this.showLanguagesModal.bind(this)}
            />
          </bem.FormView__cell>
        )}
      </bem.FormView__cell>
    );
  }
  render() {
    var docTitle = this.state.name || t('Untitled');
    const userCanEdit = userCan('change_asset', this.state);
    const isLoggedIn = sessionStore.isLoggedIn;

    if (this.state.uid === undefined) {
      return <LoadingSpinner />;
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='form'>
          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m='label'>
                {this.state.deployment__active
                  ? t('Current version')
                  : this.state.has_deployment
                  ? t('Archived version')
                  : t('Draft version')}
              </bem.FormView__cell>
              <bem.FormView__cell m='action-buttons'>
                {this.renderButtons(userCanEdit)}
              </bem.FormView__cell>
            </bem.FormView__cell>
            <bem.FormView__cell m='box'>
              {this.isFormRedeploymentNeeded() && (
                <bem.FormView__cell>
                  <InlineMessage
                    icon='alert'
                    type='warning'
                    message={t(
                      'If you want to make these changes public, you must deploy this form.'
                    )}
                  />
                </bem.FormView__cell>
              )}
              {this.renderFormInfo(userCanEdit)}
              {this.renderLanguages(userCanEdit)}
            </bem.FormView__cell>
          </bem.FormView__row>
          {this.state.deployed_versions.count > 0 && this.renderHistory()}
          {this.state.deployed_versions.count > 0 &&
            this.state.deployment__active &&
            isLoggedIn &&
            this.renderCollectData()}
        </bem.FormView>
      </DocumentTitle>
    );
  }
}

reactMixin(FormLanding.prototype, mixins.dmix);
reactMixin(FormLanding.prototype, Reflux.ListenerMixin);

export default withRouter(FormLanding);
