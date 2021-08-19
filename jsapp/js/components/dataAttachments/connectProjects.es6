import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import dataAttachmentsUtils from 'js/components/dataAttachments/dataAttachmentsUtils';
import Select from 'react-select';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import bem from 'js/bem';
import {generateAutoname} from 'js/utils';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import envStore from 'js/envStore';
import {
  MODAL_TYPES,
  MAX_DISPLAYED_STRING_LENGTH,
} from 'js/constants';

import './connect-projects.scss';

const DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL = 'dynamic_data_attachment.html';

/*
 * Modal for connecting project data
 *
 * @prop {object} asset
 */
class ConnectProjects extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isInitialised: false,
      isLoading: false,
      // `data_sharing` is an empty object if never enabled before
      isShared: props.asset.data_sharing?.enabled || false,
      isSharingAnyQuestions: Boolean(props.asset.data_sharing?.fields?.length) || false,
      attachedSources: [],
      sharingEnabledAssets: null,
      newSource: null,
      newFilename: '',
      columnsToDisplay: [],
      fieldsErrors: {},
    };

    if (this.state.isShared) {
      this.state.columnsToDisplay = dataAttachmentsUtils.generateColumnFilters(
          this.props.asset.data_sharing.fields,
          this.props.asset.content.survey,
      );
    }


    autoBind(this);

    this.unlisteners = [];
  }

  /*
   * Setup
   */

  componentDidMount() {
    this.unlisteners.push(
      actions.dataShare.attachToSource.started.listen(
        this.markComponentAsLoading
      ),
      actions.dataShare.attachToSource.completed.listen(
        this.refreshAttachmentList
      ),
      actions.dataShare.attachToSource.failed.listen(
        this.onAttachToSourceFailed
      ),
      actions.dataShare.detachSource.completed.listen(
        this.refreshAttachmentList
      ),
      actions.dataShare.patchSource.started.listen(
        this.markComponentAsLoading
      ),
      actions.dataShare.patchSource.completed.listen(
        this.onPatchSourceCompleted
      ),
      actions.dataShare.getSharingEnabledAssets.completed.listen(
        this.onGetSharingEnabledAssetsCompleted
      ),
      actions.dataShare.getAttachedSources.completed.listen(
        this.onGetAttachedSourcesCompleted
      ),
      actions.dataShare.toggleDataSharing.completed.listen(
        this.onToggleDataSharingCompleted
      ),
      actions.dataShare.updateColumnFilters.completed.listen(
        this.onUpdateColumnFiltersCompleted
      ),
      actions.dataShare.updateColumnFilters.failed.listen(
        this.stopLoading
      ),
      actions.dataShare.detachSource.failed.listen(
        this.stopLoading
      ),
      actions.dataShare.patchSource.completed.listen(
        this.stopLoading
      ),
      actions.dataShare.patchSource.failed.listen(
        this.stopLoading
      ),
    );

    this.refreshAttachmentList();

    actions.dataShare.getSharingEnabledAssets();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /*
   * `actions` Listeners
   */

  onAttachToSourceFailed(response) {
    this.setState({
      isLoading: false,
      fieldsErrors: response?.responseJSON || t('Please check file name'),
    });
  }

  onGetAttachedSourcesCompleted(response) {
    this.setState({
      isInitialised: true,
      isLoading: false,
      attachedSources: response,
    });
  }

  onGetSharingEnabledAssetsCompleted(response) {
    this.setState({sharingEnabledAssets: response});
  }

  onToggleDataSharingCompleted(response) {
    this.setState({
      isShared: response.data_sharing.enabled,
      isSharingAnyQuestions: false,
      columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(
        [],
        this.props.asset.content.survey,
      ),
    });
  }

  // Safely update state after guaranteed column changes
  onUpdateColumnFiltersCompleted(response) {
    this.setState({
      isLoading: false,
      columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(
        response.data_sharing.fields,
        this.props.asset.content.survey,
      ),
    });
  }

  onPatchSourceCompleted() {
    actions.dataShare.getAttachedSources(this.props.asset.uid);
  }

  refreshAttachmentList() {
    this.setState({
      newSource: null,
      newFilename: '',
      fieldsErrors: {},
    });
    actions.dataShare.getAttachedSources(this.props.asset.uid);
  }

  stopLoading() {
    this.setState({isLoading: false});
  }

  /*
   * UI Listeners
   */

  onFilenameChange(newVal) {
    this.setState({
      newFilename: newVal,
      fieldsErrors: {},
    });
  }

  onSourceChange(newVal) {
    this.setState({
      newSource: newVal,
      newFilename: generateAutoname(
        newVal?.name,
        0,
        MAX_DISPLAYED_STRING_LENGTH.connect_projects
      ),
      fieldsErrors: {},
    });
  }

  onConfirmAttachment(evt) {
    evt.preventDefault();
    if (this.state.newFilename !== '' && this.state.newSource?.url) {
      this.setState({
        fieldsErrors: {},
      });

      this.showColumnFilterModal(
        this.props.asset,
        this.state.newSource,
        this.state.newFilename,
        [],
      );
    } else {
      if (!this.state.newSource?.url) {
        this.setState((state) => {
          return {
            fieldsErrors: {
              ...state.fieldsErrors,
              source: t('No project selected')
            }
          }
        });
      }
      if (this.state.newFilename === '') {
        this.setState((state) => {
          return {
            fieldsErrors: {
              ...state.fieldsErrors,
              filename: t('Field is empty')
            }
          }
        });
      }
    }
  }

  onRemoveAttachment(newVal) {
    this.setState({isLoading: true});
    actions.dataShare.detachSource(newVal);
  }

  onToggleSharingData() {
    const data = {
      data_sharing: {
        enabled: !this.state.isShared,
        fields: [],
      },
    };

    if (!this.state.isShared) {
      let dialog = alertify.dialog('confirm');
      let opts = {
        title: `${t('Privacy Notice')}`,
        message: t('This will attach the full dataset from "##ASSET_NAME##" as a background XML file to this form. While not easily visible, it is technically possible for anyone entering data to your form to retrieve and view this dataset. Do not use this feature if "##ASSET_NAME##" includes sensitive data.').replaceAll('##ASSET_NAME##', this.props.asset.name),
        labels: {ok: t('Acknowledge and continue'), cancel: t('Cancel')},
        onok: () => {
          actions.dataShare.toggleDataSharing(this.props.asset.uid, data);
          dialog.destroy();
        },
        oncancel: dialog.destroy,
      };
      dialog.set(opts).show();
    } else {
      actions.dataShare.toggleDataSharing(this.props.asset.uid, data);
    }
  }

  onColumnSelected(columnList) {
    this.setState({isLoading: true});

    const fields = [];
    columnList.forEach((item) => {
      if (item.checked) {
        fields.push(item.label);
      }
    });

    const data = {
      data_sharing: {
        enabled: this.state.isShared,
        fields: fields,
      },
    };

    actions.dataShare.updateColumnFilters(this.props.asset.uid, data);
  }

  onSharingCheckboxChange(checked) {
    let columnsToDisplay = this.state.columnsToDisplay;
    if (!checked) {
      columnsToDisplay = [];
      const data = {
        data_sharing: {
          enabled: this.state.isShared,
          fields: [],
        },
      };
      actions.dataShare.updateColumnFilters(this.props.asset.uid, data);
    }

    this.setState({
      columnsToDisplay: columnsToDisplay,
      isSharingAnyQuestions: checked,
    });
  }

  /*
   * Utilities
   */

  generateFilteredAssetList() {
    let attachedSourceUids = [];
    this.state.attachedSources.forEach((item) => {
      attachedSourceUids.push(item.sourceUid);
    });

    // Filter out attached projects from displayed asset list
    return (
      this.state.sharingEnabledAssets.results.filter(
        item => !attachedSourceUids.includes(item.uid)
      )
    );
  }

  showColumnFilterModal(asset, source, filename, fields, attachmentUrl) {
    stores.pageState.showModal(
      {
        type: MODAL_TYPES.DATA_ATTACHMENT_COLUMNS,
        asset: asset,
        source: source,
        filename: filename,
        fields: fields,
        attachmentUrl: attachmentUrl,
      }
    );
  }

  markComponentAsLoading() {
    this.setState({isLoading: true});
  }

  /*
   * Rendering
   */

  //TODO: Use BEM elements instead

  renderSelect() {
    if (this.state.sharingEnabledAssets !== null) {
      let sharingEnabledAssets = this.generateFilteredAssetList();
      const selectClassNames = ['kobo-select__wrapper'];
      if (this.state.fieldsErrors?.source) {
        selectClassNames.push('kobo-select__wrapper--error');
      }
      return(
        <div className={selectClassNames.join(' ')}>
          <Select
            placeholder={t('Select a different project to import data from')}
            options={sharingEnabledAssets}
            value={this.state.newSource}
            isLoading={(!this.state.isInitialised || this.state.isLoading)}
            getOptionLabel={(option) => option.name}
            getOptionValue={(option) => option.url}
            noOptionsMessage={() => t('No projects to connect')}
            onChange={this.onSourceChange}
            className='kobo-select'
            classNamePrefix='kobo-select'
          />

          <label className='select-errors'>
            {this.state.fieldsErrors?.source}
          </label>
        </div>
      );
    }
  }

  renderExports() {
    if (this.state.isShared) {
      return (
        <div className='connect-projects__export'>
          <div className='connect-projects__export-options'>
            <ToggleSwitch
              onChange={this.onToggleSharingData.bind(this)}
              label={t('Data sharing enabled')}
              checked={this.state.isShared}
            />

            <Checkbox
              name='sharing'
              checked={this.state.isSharingAnyQuestions}
              onChange={this.onSharingCheckboxChange}
              label={t('Select specific questions to share')}
            />
          </div>

          {this.state.isSharingAnyQuestions &&
            <div className='connect-projects__export-multicheckbox'>
              <span>
                {t('Select any questions you want to share in the right side table')}
                {this.state.isLoading &&
                  <LoadingSpinner message={t('Updating shared questions')}/>
                }
              </span>

              <MultiCheckbox
                items={this.state.columnsToDisplay}
                disabled={this.state.isLoading}
                onChange={this.onColumnSelected}
              />
            </div>
          }
        </div>
      );
    } else {
      return (
        <div className='connect-projects__export'>
          <div className='connect-projects__export-switch'>
            <ToggleSwitch
              onChange={this.onToggleSharingData.bind(this)}
              label={t('Data sharing disabled')}
              checked={this.state.isShared}
            />
          </div>
        </div>
      );
    }
  }

  renderImports() {
    return (
      <div className='connect-projects__import'>
        <div className='connect-projects__import-form'>
          {this.renderSelect()}

          <TextBox
            placeholder={t('Give a unique name to the import')}
            value={this.state.newFilename}
            onChange={this.onFilenameChange}
            errors={this.state.fieldsErrors.filename}
          />

          <bem.KoboButton
            m='blue'
            onClick={this.onConfirmAttachment}
          >
            {t('Import')}
          </bem.KoboButton>
        </div>

        {/* Display attached projects */}
        <ul className='connect-projects__import-list'>
          <label>{t('Imported')}</label>

          {(!this.state.isInitialised || this.state.isLoading) &&
            <div className='connect-projects__import-list-item'>
              <LoadingSpinner message={t('Loading imported projects')} />
            </div>
          }

          {!this.state.isLoading && this.state.attachedSources.length == 0 &&
            <li className='connect-projects__import-list-item--no-imports'>
              {t('No data imported')}
            </li>
          }

          {!this.state.isLoading && this.state.attachedSources.length > 0 &&
            this.state.attachedSources.map((item, n) => {
              return (
                <li key={n} className='connect-projects__import-list-item'>
                  <i className='k-icon k-icon-check'/>

                  <div className='connect-projects__import-labels'>
                    <span className='connect-projects__import-labels-filename'>
                      {item.filename}
                    </span>

                    <span className='connect-projects__import-labels-source'>
                      {item.sourceName}
                    </span>
                  </div>

                  <div className='connect-projects__import-options'>
                    <bem.KoboLightButton
                      m={['red', 'icon-only']}
                      onClick={() => this.onRemoveAttachment(item.attachmentUrl)}
                    >
                      <i className='k-icon k-icon-trash'/>
                    </bem.KoboLightButton>

                    <bem.KoboLightButton
                      m={['blue', 'icon-only']}
                      onClick={() => this.showColumnFilterModal(
                        this.props.asset,
                        {
                          uid: item.sourceUid,
                          name: item.sourceName,
                          url: item.sourceUrl,
                        },
                        item.filename,
                        item.linkedFields,
                        item.attachmentUrl,
                      )}
                    >
                      <i className='k-icon k-icon-settings'/>
                    </bem.KoboLightButton>
                  </div>
                </li>
              );
            })
          }
        </ul>
      </div>
    );
  }

  render() {
    return (
      <bem.FormView__row>
        {/* Enable data sharing */}
        <bem.FormView__cell m={['page-title']}>
          <i className="k-icon k-icon-folder-out"/>
          <h2>{t('Share data with other project forms')}</h2>
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'padding']}>
          <bem.FormView__form>
            <span>
              {t('Enable data sharing to allow other forms to import and use dynamic data from this project. Learn more about dynamic data attachments')}
              &nbsp;
              <a
                href={
                  envStore.data.support_url +
                  DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL
                }
                target='_blank'
              >
                {t('here')}
              </a>
            </span>

            {this.renderExports()}
          </bem.FormView__form>
        </bem.FormView__cell>

        {/* Attach other projects data */}
        <bem.FormView__cell m={['page-title']}>
          <i className="k-icon k-icon-folder-in"/>
          <h2>{t('Import other project data')}</h2>
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'padding']}>
          <bem.FormView__form>
            <span>
              {t('Connect with other project(s) to import dynamic data from them into this project. Learn more about dynamic data attachments')}
              &nbsp;
              <a
                href={
                  envStore.data.support_url +
                  DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL
                }
                target='_blank'
              >
                {t('here')}
              </a>
            </span>
            {this.renderImports()}
          </bem.FormView__form>
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }
}

export default ConnectProjects;
