import React from 'react/addons';
import Reflux from 'reflux';
import Dropzone from '../libs/dropzone';
import _ from 'underscore';
import {
  Navigation,
} from 'react-router';
import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import ui from '../ui';
import mixins from '../mixins';
import mdl from '../libs/rest_framework/material';
import DocumentTitle from 'react-document-title';
import CopyToClipboard from 'react-copy-to-clipboard';
import icons from '../../xlform/src/view.icons';

import {
  formatTime,
  currentLang,
  assign,
  t,
  log,
  notify,
} from '../utils';

var FormLanding = React.createClass({
  mixins: [
    Navigation,
    mixins.droppable,
    mixins.taggedAsset,
    mixins.dmix,
    Reflux.ListenerMixin
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setAssetNavPresent(false);
      stores.pageState.setDrawerHidden(false);
      stores.pageState.setHeaderHidden(false);
      actions.resources.loadAsset({id: params.assetid});
      callback();
    }
  },
  renderFormInfo () {
    var dvcount = this.state.deployed_versions.length;
    return (
        <bem.FormView__cell m={['columns', 'padding']}>
          <bem.FormView__cell m='label'>
            {dvcount > 0 ? `v${dvcount}` : ''}
            <bem.FormView__cell m='date'>
              {t('Last modified: ')}
              {formatTime(this.state.date_modified)}
            </bem.FormView__cell>
          </bem.FormView__cell>
          <bem.FormView__cell m='buttons'>
            {this.state.userCanEdit ?
              <a className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored"
                  href={this.makeHref('form-edit', {assetid: this.state.uid})}>
                {t('edit form')}
              </a>
              
            : 
              <a className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored disabled"
                  data-tip={t('Editing capabilities not granted, you can only view this form')}>
                {t('edit form')}
              </a>
            }
          </bem.FormView__cell>
        </bem.FormView__cell>
      );
  },
  renderFormLanguages () {
    return (
      <bem.FormView__cell m={['padding', 'bordertop', 'languages']}>
        {t('Languages')}
        {this.state.summary.languages}
      </bem.FormView__cell>
    );
  },
  renderQuestionsSummary () {
    var survey = this.state.content.survey || [];
    return (
      <bem.FormView__cell m={['padding', 'bordertop', 'questions', 'columns']}>
        <bem.FormView__cell m='label'>
          <div>{t('Questions')}</div>
          <div className="question-count">{this.state.summary.row_count}</div>
        </bem.FormView__cell>
        <bem.FormView__cell m={['question-list']}>
          {survey.map((s, i)=>{
            if (s.label == undefined) return false;
            var faClass = `fa-${icons._byId[s.type].attributes.faClass}`;
            return (
                <div key={`survey-${i}`}>
                  <i className={`fa fa-fw ${faClass}`} />
                  <span>{s.label[0]}</span>
                </div>
              );
          })}
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  },
  renderHistory () {
    var dvcount = this.state.deployed_versions.length;
    return (
      <bem.FormView__row>
        <bem.FormView__cell m='columns'>
          <bem.FormView__cell m='label'>
            {t('Form history')}
          </bem.FormView__cell>
        </bem.FormView__cell>
        <bem.FormView__cell m='box'>
          <bem.FormView__group m="deployments" className={this.state.historyExpanded ? 'historyExpanded' : 'historyHidden'}>
            <bem.FormView__group m="items">
              <bem.FormView__label m='version'>{t('Version')}</bem.FormView__label>
              <bem.FormView__label m='date'>{t('Last modified')}</bem.FormView__label>
              {/*<bem.FormView__label m='lang'>{t('Languages')}</bem.FormView__label>*/}
              {/*<bem.FormView__label m='questions'>{t('Questions')}</bem.FormView__label>*/}
              <bem.FormView__label m='clone'>{t('Clone')}</bem.FormView__label>
            </bem.FormView__group>
            {this.state.deployed_versions.map((item, n) => {
              return (
                <bem.FormView__group m="items" key={n} className={ n < 3 ? 'visible' : 'toggled'} >
                  <bem.FormView__label m='version'>
                    {`v${dvcount-n}`}
                    {item.uid === this.state.deployed_version_id && this.state.deployment__active && 
                      <bem.FormView__cell m='deployed'>
                        {t('Deployed')}
                      </bem.FormView__cell>
                    }
                  </bem.FormView__label>
                  <bem.FormView__label m='date'>
                    {formatTime(item.date_deployed)}
                  </bem.FormView__label>
                  {/*<bem.FormView__label m='lang'></bem.FormView__label>*/}
                  {/*<bem.FormView__label m='questions'></bem.FormView__label>*/}
                  <bem.FormView__label m='clone'>
                      <bem.FormView__link m='clone'
                          data-version-id={item.version_id}
                          data-tip={t('Clone as new project')}
                          onClick={this.saveCloneAs}>
                        <i className="k-icon-clone" />
                      </bem.FormView__link>
                  </bem.FormView__label>
                </bem.FormView__group>
              );
            })}
          </bem.FormView__group>
        </bem.FormView__cell>
        {this.state.deployed_versions.length > 3 &&
          <bem.FormView__cell m={['centered', 'padding']}>
            <button className="mdl-button mdl-js-button mdl-button--colored" onClick={this.toggleDeploymentHistory}>
              {this.state.historyExpanded ? t('Hide full history') : t('Show full history')}
            </button>
          </bem.FormView__cell>
        }
      </bem.FormView__row>
      );
  },
  renderInstructions () {
    var deployment__links = this.state.deployment__links;
    var available__links = {
        offline_url: {
          label: t('Online-Offline (multiple submission)'),
          desc: t('This allows online and offline submissions and is the best option for collecting data in the field. ')
        },
        url: {
          label: t('Online-Only (multiple submissions)'),
          desc: t('This is the best option when entering many records at once on a computer, e.g. for transcribing paper records')
        },
        iframe_url: {
          label: t('Embeddable web form code'),
          desc: t('Use this html5 code snippet to integrate your form on your own website using smaller margins. ')
        },
        preview_url: {
          label: t('View only'),
          desc: t('Use this version for testing, getting feedback. Does not allow submitting data. ')
        }
    };

    var deployment__links_list = [];
    var value = undefined;
 
    for (var key in available__links) {
      if (key == 'iframe_url')
        value = '<iframe src="'+deployment__links[key]+'" width="800" height="600"></iframe>';
      else
        value = deployment__links[key];

      deployment__links_list.push(
        {
          key: key,
          value: value,
          label: available__links[key].label,
          desc: available__links[key].desc
        }
      );
    }
 
    var kc_server = document.createElement('a');
    kc_server.href = this.state.deployment__identifier;
    var kobocollect_url = kc_server.origin + '/' + this.state.owner__username;
 
    return (
      <bem.FormView__row m="collecting">
        <bem.FormView__cell m='collecting-webforms'>
          <bem.FormView__banner m="webforms">
            <bem.FormView__label m='white'>
              {t('Collecting Data with Web Forms')}
            </bem.FormView__label>
          </bem.FormView__banner>
          <a href="http://support.kobotoolbox.org/customer/en/portal/articles/1653790-collecting-data-through-web-forms"
             className="collect-link collect-link__web"
             target="_blank">
            {t('Learn more')}
            <i className="fa fa-arrow-right"></i>
          </a>

          <ui.MDLPopoverMenu id={"collect-options"}
                            button_type='text' 
                            button_label={this.state.selectedCollectOption.label != null ? t(this.state.selectedCollectOption.label) : t('Choose an option')}
                            classname='form-view__item--collect'
                            menuClasses='mdl-menu mdl-menu--top-right mdl-js-menu'
                            caretClass='fa fa-caret-up'>
            {deployment__links_list.map((c)=>{
              return (
                  <bem.PopoverMenu__link  key={`c-${c.value}`}
                                          onClick={this.setSelectedCollectOption(c)}
                                          className={this.state.selectedCollectOption.value == c.value ? 'active' : null}>
                    <span className="label">{c.label}</span>
                    <span className="desc">{c.desc}</span>
                  </bem.PopoverMenu__link>
                );
            })}
          </ui.MDLPopoverMenu>

          {this.state.selectedCollectOption.value ?
            <bem.FormView__item m={'collect-links'}>
              <CopyToClipboard text={this.state.selectedCollectOption.value}
                onCopy={() => notify('copied to clipboard')}>
                <a className="copy">Copy</a>
              </CopyToClipboard>

              {this.state.selectedCollectOption.key != 'iframe_url' ?
                <a href={this.state.selectedCollectOption.value} target="_blank" className="open">
                  {t('Open')}
                </a>
              : null }
            </bem.FormView__item>
          : null }
        </bem.FormView__cell>
        <bem.FormView__cell m='collecting-android'>
          <bem.FormView__banner m="android">
            <bem.FormView__label m='white'>
              {t('Collecting Data with Android App')}
            </bem.FormView__label>
          </bem.FormView__banner>
          <a href="http://support.kobotoolbox.org/customer/en/portal/articles/1653782-collecting-data-with-kobocollect-on-android"
             className="collect-link collect-link__android"
             target="_blank">
            {t('Learn more')}
            <i className="fa fa-arrow-right"></i>
          </a>
 
          <ol>
            <li>
              {t('Install')}
              &nbsp;
              <a href="https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en" target="_blank">KoboCollect</a>
              &nbsp;
              {t('on your Android device.')}
            </li>
            <li>{t('Click on')} <i className="k-icon-more"></i> {t('to open settings.')}</li>
            <li>{t('Enter the server URL') + ' ' + kobocollect_url + ' ' + t('and your username and password')}</li>
            <li>{t('Open "Get Blank Form" and select this project. ')}</li>
            <li>{t('Open "Enter Data."')}</li>
          </ol>
        </bem.FormView__cell>
      </bem.FormView__row>
      );
  },
  renderButtons () {
    var downloadable = false;
    var downloads = [];
    if (this.state.downloads) {
      downloadable = !!this.state.downloads[0];
      downloads = this.state.downloads;
    }

    return (
        <bem.FormView__group m='buttons'>
          {this.state.userCanEdit && 
            <bem.FormView__link m={'deploy'}
              onClick={this.deployAsset}
              data-tip={this.state.has_deployment ? t('redeploy') : t('deploy')}>
              <i className="k-icon-deploy" />
            </bem.FormView__link>
          }
          <bem.FormView__link m='preview'
            href={this.makeHref('form-preview-enketo', {assetid: this.state.uid})}
            data-tip={t('Preview')}>
            <i className="k-icon-view" />
          </bem.FormView__link>
          {this.state.userCanEdit && 
            <Dropzone fileInput onDropFiles={this.onDrop}
                  disabled={!this.state.userCanEdit}>
              <bem.FormView__link m={['upload', {
                disabled: !this.state.userCanEdit
                  }]}
                  data-tip={t('Replace with XLS')}>
                <i className="k-icon-replace" />
              </bem.FormView__link>
            </Dropzone>
          }
          { downloadable &&
            <ui.MDLPopoverMenu id={"more-dl-popover"}>
              {downloads.map((dl)=>{
                return (
                    <bem.PopoverMenu__link m={`dl-${dl.format}`} href={dl.url}
                        key={`dl-${dl.format}`}>
                      <i className={`k-icon-${dl.format}-file`}/>
                      {t('Download')}&nbsp;
                      {dl.format.toString().toUpperCase()}
                    </bem.PopoverMenu__link>
                  );
              })}
              {this.state.userCanEdit && 
                <bem.PopoverMenu__link href={this.makeHref('form-settings-sharing', {assetid: this.state.uid})}>
                  <i className="k-icon-share"/>
                  {t('Share this project')}
                </bem.PopoverMenu__link>
              }
              <bem.PopoverMenu__link onClick={this.saveCloneAs}>
                <i className="k-icon-clone"/>
                {t('Clone this project')}
              </bem.PopoverMenu__link>
            </ui.MDLPopoverMenu>
          }
        </bem.FormView__group>
      );
  },
  render () {
    var docTitle = this.state.name || t('Untitled');

    if (this.state.uid == undefined) {
      return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              <i />
              {t('loading...')}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
      );
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='form'>
          <bem.FormView__row>
            <bem.FormView__cell m='columns'>
              <bem.FormView__cell m='label'>
                {this.state.deployment__active ? t('Current version') :
                  this.state.has_deployment ? t('Archived version') :
                    t('Draft version')}
              </bem.FormView__cell>
              <bem.FormView__cell>
                {this.renderButtons()}
                <bem.FormView__link m='close' href={this.makeHref('forms')} className='is-edge' />
              </bem.FormView__cell>
            </bem.FormView__cell>
            <bem.FormView__cell m='box'>
              {this.state.deployed_versions.length > 0 &&
                this.state.deployed_version_id != this.state.version_id &&
                <bem.FormView__cell m='warning'>
                  <i className="k-icon-alert" />
                  {t('If you want to make these changes public, you must deploy this form')}
                </bem.FormView__cell>
              }
              {this.renderFormInfo()}
              {this.state.summary && this.state.summary.languages && this.state.summary.languages[0] != null && 
                this.renderFormLanguages()
              }
              {this.state.summary.row_count > 0 && 
                this.renderQuestionsSummary()
              }
            </bem.FormView__cell>
          </bem.FormView__row>
          {this.state.deployed_versions.length > 0 &&
            this.renderHistory()
          }
        </bem.FormView> 
      </DocumentTitle>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }

})

export default FormLanding;
