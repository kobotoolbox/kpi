import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import assetUtils from 'js/assetUtils';
import Select from 'react-select';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import {actions} from 'js/actions';
import {stores} from '../../stores';
import {bem} from 'js/bem';
import {renderLoading} from '../modalForms/modalHelpers';

import {
  MODAL_TYPES,
  MAX_DISPLAYED_STRING_LENGTH,
} from '../../constants';

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
      isSharingSomeQuestions: props.asset.data_sharing?.fields?.length || false,
      attachedParents: [],
      sharingEnabledAssets: null,
      newParent: null,
      newFilename: '',
      columnsToDisplay: [],
      fieldsErrors: {},
    };

    autoBind(this);

    this.unlisteners = [];
  }

  /*
   * Setup
   */

  componentDidMount() {
    this.unlisteners.push(
      actions.dataShare.attachToParent.completed.listen(
        this.refreshAttachmentList
      ),
      actions.dataShare.attachToParent.failed.listen(
        this.onAttachToParentFailed
      ),
      actions.dataShare.detachParent.completed.listen(
        this.refreshAttachmentList
      ),
      actions.dataShare.patchParent.completed.listen(
        this.onPatchParentCompleted
      ),
      actions.dataShare.getSharingEnabledAssets.completed.listen(
        this.onGetSharingEnabledAssetsCompleted
      ),
      actions.dataShare.getAttachedParents.completed.listen(
        this.onGetAttachedParentsCompleted
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
      actions.dataShare.detachParent.failed.listen(
        this.stopLoading
      ),
      actions.dataShare.patchParent.completed.listen(
        this.stopLoading
      ),
      actions.dataShare.patchParent.failed.listen(
        this.stopLoading
      ),
    );

    this.refreshAttachmentList();

    if (this.state.isShared) {
      this.setState({
        columnsToDisplay: this.generateColumnFilters(
          this.props.asset.data_sharing.fields,
          this.props.asset.content.survey,
        ),
      });
    }

    actions.dataShare.getSharingEnabledAssets();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /*
   * `actions` Listeners
   */

  onAttachToParentFailed(response) {
    this.setState({
      isLoading: false,
      fieldsErrors: response.responseJSON,
    });
  }

  onGetAttachedParentsCompleted(response) {
    this.setState({
      isInitialised: true,
      isLoading: false,
      attachedParents: response,
    });
  }

  onGetSharingEnabledAssetsCompleted(response) {
    this.setState({sharingEnabledAssets: response});
  }

  onToggleDataSharingCompleted(response) {
    this.setState({
      isShared: response.data_sharing.enabled,
      isSharingSomeQuestions: false,
      columnsToDisplay: this.generateColumnFilters(
        [],
        this.props.asset.content.survey,
      ),
    });
  }

  // Safely update state after guaranteed column changes
  onUpdateColumnFiltersCompleted(response) {
    this.setState({
      isLoading: false,
      columnsToDisplay: this.generateColumnFilters(
        response.data_sharing.fields,
        this.props.asset.content.survey,
      ),
    });
  }

  onPatchParentCompleted() {
    actions.dataShare.getAttachedParents(this.props.asset.uid);
  }

  refreshAttachmentList() {
    this.setState({
      newParent: null,
      newFilename: '',
    });
    actions.dataShare.getAttachedParents(this.props.asset.uid);
  }

  stopLoading () {
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

  onParentChange(newVal) {
    this.setState({
      newParent: newVal,
      fieldsErrors: {},
    });
    this.generateAutoname(newVal);
  }

  onConfirmAttachment(evt) {
    evt.preventDefault();
    if (this.state.newFilename !== '' && this.state.newParent?.url) {
      this.setState({
        fieldsErrors: {},
      });

      this.showColumnFilterModal(
        this.props.asset,
        this.state.newParent,
        this.state.newFilename,
        [],
      );
    } else {
      if (!this.state.newParent?.url) {
        this.setState((state) => {
          return {
            fieldsErrors: {
              ...state.fieldsErrors,
              parent: t('No project selected')
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
    this.setState({isLoading: true})
    actions.dataShare.detachParent(newVal);
  }

  onToggleSharingData() {
    const data = JSON.stringify({
      data_sharing: {
        enabled: !this.state.isShared,
        fields: [],
      }
    });

    if (!this.state.isShared) {
      let dialog = alertify.dialog('confirm');
      let opts = {
        title: `${t('Privacy Notice')}`,
        message: t('This will attach the full dataset from \"##ASSET_NAME##\" as a background XML file to this form. While not easily visible, it is technically possible for anyone entering data to your form to retrieve and view this dataset. Do not use this feature if \"##ASSET_NAME##\" includes sensitive data.').replaceAll('##ASSET_NAME##', this.props.asset.name),
        labels: {ok: t('Acknowledge and continue'), cancel: t('Cancel')},
        onok: (evt, value) => {
          actions.dataShare.toggleDataSharing(this.props.asset.uid, data);
          dialog.destroy();
        },
        oncancel: () => {
          dialog.destroy();
        }
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
    })
    const data = JSON.stringify({
      data_sharing: {
        enabled: this.state.isShared,
        fields: fields,
      }
    });

    actions.dataShare.updateColumnFilters(this.props.asset.uid, data);
  }

  onSharingCheckboxChange(checked) {
    let columnsToDisplay = this.state.columnsToDisplay;
    if (!checked) {
      columnsToDisplay = [];
      const data = JSON.stringify({
        data_sharing: {
          enabled: this.state.isShared,
          fields: [],
        }
      });
      actions.dataShare.updateColumnFilters(this.props.asset.uid, data);
    }

    this.setState({
      columnsToDisplay: columnsToDisplay,
      isSharingSomeQuestions: checked,
    });
  }

  /*
   * Utilities
   */

  // Generates a filename for the selected parent, done so by taking the first
  // 30 characters, turning them lowercase and replacing spaces with underscores
  generateAutoname(newParent) {
    if (newParent) {
      const autoname = newParent.name
        .toLowerCase()
        .substring(0, MAX_DISPLAYED_STRING_LENGTH.connect_projects)
        .replace(/(\ |\.)/g, '_');
      this.setState({newFilename: autoname});
    }
  }

  // Figure out what columns need to be 'checked' or 'unchecked' by comparing
  // `selectedColumns` - the columns that are already selected versus
  // `selectableColumns` - the columns that are allowed to be exposed
  generateColumnFilters(selectedColumns, selectableQuestions) {
    let selectableColumns = [];

    // We need to flatten questions if coming from survey
    if (selectableQuestions?.length && typeof selectableQuestions[0] === 'object') {
      let questions = assetUtils.getSurveyFlatPaths(selectableQuestions);
      for (const key in questions) {
        if (!questions[key].includes('version')) {
          selectableColumns.push(questions[key]);
        }
      }
    } else {
      selectableColumns = selectableQuestions;
    }

    const columnsToDisplay = [];
    // Columns are unchecked by default to avoid exposing new questions if user
    // has selected `Share some questions`
    if (selectedColumns.length == 0) {
      selectableColumns.forEach((column) => {
        columnsToDisplay.push({label: column, checked: false});
      });
    } else {
      selectableColumns.forEach((column) => {
        // 'Check' only matching columns
        columnsToDisplay.push({
          label: column,
          checked: selectedColumns.includes(column),
        });
      });
    }
    return columnsToDisplay;
  }

  generateFilteredAssetList() {
    let attachedParentUids = [];
    this.state.attachedParents.forEach((item) => {
      attachedParentUids.push(item.parentUid)
    });

    // Filter out attached projects from displayed asset list
    return (
      this.state.sharingEnabledAssets.results.filter(
        item => !attachedParentUids.includes(item.uid)
      )
    );
  }

  showColumnFilterModal(asset, parent, filename, fields, attachmentUrl) {
    stores.pageState.showModal(
      {
        type: MODAL_TYPES.DATA_ATTACHMENT_COLUMNS,
        generateColumnFilters: this.generateColumnFilters,
        triggerParentLoading: this.triggerParentLoading,
        asset: asset,
        parent: parent,
        filename: filename,
        fields: fields,
        attachmentUrl: attachmentUrl,
      }
    );
  }

  // Allows import modal trigger loading of this modal
  triggerParentLoading() {
    this.setState({isLoading: true})
  }

  /*
   * Rendering
   */

  renderSelect() {
    if (this.state.sharingEnabledAssets !== null) {
      let sharingEnabledAssets = this.generateFilteredAssetList();
      const selectClassNames = ['kobo-select__wrapper'];
      if (this.state.fieldsErrors?.parent) {
        selectClassNames.push('kobo-select__wrapper--error');
      }
      return(
        <div className={selectClassNames.join(' ')}>
          <Select
            placeholder={t('Select a different project to import data from')}
            options={sharingEnabledAssets}
            value={this.state.newParent}
            isLoading={(!this.state.isInitialised || this.state.isLoading)}
            getOptionLabel={option => option.name}
            getOptionValue={option => option.url}
            noOptionsMessage={() => {return t('No projects to connect')}}
            onChange={this.onParentChange}
            className='kobo-select'
            classNamePrefix='kobo-select'
          />

          <label className='select-errors'>
            {this.state.fieldsErrors?.parent}
          </label>
        </div>
      );
    }
  }

  renderExports() {
    if (this.state.isShared) {
      return (
        <div className='connect-projects__export'>
          <div className='connect-projects__export--options'>
            <ToggleSwitch
              onChange={this.onToggleSharingData.bind(this)}
              label={t('Data sharing enabled')}
              checked={this.state.isShared}
            />

            <Checkbox
              name='sharing'
              checked={this.state.isSharingSomeQuestions}
              onChange={this.onSharingCheckboxChange}
              label={t('Select specific questions to share')}
            />
          </div>

          {this.state.isSharingSomeQuestions &&
            <div className='connect-projects__export--multicheckbox'>
              <span>
                {t('Select any questions you want to share in the right side table')}
                {this.state.isLoading &&
                  renderLoading(t('Updating shared questions'))
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
          <div className='connect-projects__export--switch'>
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
        <div className='connect-projects__import--form'>
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
        <ul className='connect-projects__import--list'>
          <label>{t('Imported')}</label>

          {(!this.state.isInitialised || this.state.isLoading) &&
            <div className='connect-projects__import--list-item'>
              {renderLoading(t('Loading imported projects'))}
            </div>
          }

          {!this.state.isLoading && this.state.attachedParents.length == 0 &&
            <li className='connect-projects__no-imports'>
              {t('No data imported')}
            </li>
          }

          {!this.state.isLoading && this.state.attachedParents.length > 0 &&
            this.state.attachedParents.map((item, n) => {
              return (
                <li key={n} className='connect-projects__import--list-item'>
                  <i className="k-icon k-icon-check"/>

                  <div className='connect-projects__import--labels'>
                    <span className='connect-projects__import--labels--filename'>
                      {item.filename}
                    </span>

                    <span className='connect-projects__import--labels--parent'>
                      {item.parentName}
                    </span>
                  </div>

                  <div className='connect-projects__import--options'>
                    <i
                      className="k-icon k-icon-trash"
                      onClick={() => this.onRemoveAttachment(item.attachmentUrl)}
                    />

                    <i
                      className="k-icon k-icon-settings"
                      onClick={() => this.showColumnFilterModal(
                        this.props.asset,
                        {
                          uid: item.parentUid,
                          name: item.parentName,
                          url: item.parentUrl,
                        },
                        item.filename,
                        item.childFields,
                        item.attachmentUrl,
                      )}
                    />
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
              <a href='#'>{t('here')}</a>
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
              <a href='#'>{t('here')}</a>
            </span>

            {this.renderImports()}
          </bem.FormView__form>
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }
}

export default ConnectProjects;
