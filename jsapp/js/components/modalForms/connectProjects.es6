import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Select from 'react-select';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import TextBox from 'js/components/common/textBox';
import {actions} from '../../actions';
import {bem} from 'js/bem';
import {
  truncateFile,
  truncateString,
} from '../../utils';

const MAX_DISPLAYED_STRING_LENGTH = 30;

/*
 * Modal for connecting project data
 */
class ConnectProjects extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isVirgin: true,
      isLoading: false,
      // `data_sharing` is an empty object if never enabled before
      isShared: props.asset.data_sharing?.enabled || false,
      attachedParents: [],
      sharingEnabledAssets: null,
      newParent: null,
      newFilename: '',
      fieldsErrors: {},
    };

    autoBind(this);
  }

  /*
   * Setup
   */

  componentDidMount() {
    this.refreshAttachmentList();
    actions.dataShare.getSharingEnabledAssets();

    actions.dataShare.attachToParent.completed.listen(
      this.refreshAttachmentList
    );
    actions.dataShare.attachToParent.failed.listen(
      this.onAttachToParentFailed
    );
    actions.dataShare.detachParent.completed.listen(
      this.refreshAttachmentList
    );
    actions.dataShare.getSharingEnabledAssets.completed.listen(
      this.onGetSharingEnabledAssetsCompleted
    );
    actions.dataShare.getAttachedParents.completed.listen(
      this.onGetAttachedParentsCompleted
    );
    actions.dataShare.toggleDataSharing.completed.listen(
      this.onToggleDataSharingCompleted
    );
  }

  /*
   * `actions` Listeners
   */

  onAttachToParentFailed(response) {
    this.setState({
      isLoading: false,
      fieldsErrors: response.responseJSON || {},
    });
  }
  onGetAttachedParentsCompleted(response) {
    this.setState({
      isVirgin: false,
      isLoading: false,
      attachedParents: response,
    });
  }
  onGetSharingEnabledAssetsCompleted(response) {
    this.setState({sharingEnabledAssets: response});
  }
  onToggleDataSharingCompleted() {
    this.setState({isShared: !this.state.isShared});
  }
  refreshAttachmentList() {
    this.setState({
      newParent: null,
      newFilename: '',
    });
    actions.dataShare.getAttachedParents(this.props.asset.uid);
  }


  /*
   * UI Listeners
   */

  confirmAttachment(evt) {
    evt.preventDefault();

    let parentUrl = this.state.newParent?.url;
    let filename = this.state.newFilename;
    if (filename !== '' && parentUrl) {
      this.setState({
        isLoading: true,
        fieldsErrors: {},
      });

      var data = JSON.stringify({
        parent: parentUrl,
        fields: [],
        filename: filename,
      });
      actions.dataShare.attachToParent(this.props.asset.uid, data);
    } else {
      if (!parentUrl) {
        this.setState({
          fieldsErrors: Object.assign(
            this.state.fieldsErrors, {emptyParent: 'No project selected'}
          )
        });
      }
      if (filename === '') {
        this.setState({
          fieldsErrors: Object.assign(
            this.state.fieldsErrors, {emptyFilename: 'Field is empty'}
          )
        });
      }
    }
  }
  onParentChange(newVal) {
    this.setState({
      newParent: newVal,
      fieldsErrors: {},
    });
    this.generateAutoname(newVal);
  }
  onFilenameChange(newVal) {
    this.setState({
      newFilename: newVal,
      fieldsErrors: {},
    });
  }
  removeAttachment(newVal) {
    this.setState({isLoading: true})
    actions.dataShare.detachParent(newVal);
  }
  toggleSharingData() {
    var data = JSON.stringify({
      data_sharing: {
        enabled: !this.state.isShared
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

  /*
   * Utilities
   */

  generateAutoname(newParent) {
    if (newParent) {
      let autoname = newParent.name;
      autoname = autoname.toLowerCase().substring(0, MAX_DISPLAYED_STRING_LENGTH).replace(/(\ |\.)/g, '_');
      this.setState({newFilename: autoname});
    }
  }
  generateFilteredAssetList() {
    let attachedParentUids = [];
    this.state.attachedParents.forEach((item) => {
      attachedParentUids.push(item.parentUid)
    });

    // Filter displayed asset list based on unattached projects
    return (
      this.state.sharingEnabledAssets.results.filter(
        item => !attachedParentUids.includes(item.uid)
      )
    );
  }

  /*
   * Rendering
   */

  renderLoading(message = t('loading…')) {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
  renderSwitchLabel() {
    if (this.state.isShared) {
      return (
        <ToggleSwitch
          onChange={this.toggleSharingData.bind(this)}
          label={t('Data sharing enabled')}
          checked={this.state.isShared}
        />
      );
    } else {
      return (
        <ToggleSwitch
          onChange={this.toggleSharingData.bind(this)}
          label={t('Data sharing disabled')}
          checked={this.state.isShared}
        />
      );
    }
  }
  renderSelect(sharingEnabledAssets) {
    const selectClassNames = ['kobo-select__wrapper'];
    if (this.state.fieldsErrors.emptyParent || this.state.fieldsErrors.parent) {
      selectClassNames.push('kobo-select__wrapper--error');
    }
    return(
      <div className={selectClassNames.join(' ')}>
        <Select
          placeholder={t('Select a different project to import data from')}
          options={sharingEnabledAssets}
          value={this.state.newParent}
          isLoading={(this.state.isVirgin || this.state.isLoading || !sharingEnabledAssets)}
          getOptionLabel={option => option.name}
          getOptionValue={option => option.url}
          noOptionsMessage={() => {return t('No projects to connect')}}
          onChange={this.onParentChange}
          className='kobo-select'
          classNamePrefix='kobo-select'
        />
        <label className='select-errors'>
          {this.state.fieldsErrors.emptyParent || this.state.fieldsErrors.parent}
        </label>
      </div>
    );
  }

  render() {
    let sharingEnabledAssets = [];
    if (this.state.sharingEnabledAssets !== null) {
      sharingEnabledAssets = this.generateFilteredAssetList();
    }

    return (
      <bem.FormModal__form
        className='project-settings project-settings--upload-file connect-projects'
        onSubmit={this.confirmAttachment}
      >
        {/* Enable data sharing */}
        <bem.FormModal__item m='data-sharing'>
          <div className='connect-projects-header'>
            <i className="k-icon k-icon-folder-out"/>
            <h2>{t('Share data with other project forms')}</h2>
          </div>
          <p>
            {t('Enable data sharing to allow other forms to import and use dynamic data from this project. Learn more about dynamic data attachments')}
            <a href='#'>{t(' ' + 'here')}</a>
          </p>
          {this.renderSwitchLabel()}
        </bem.FormModal__item>

        {/* Attach other projects data */}
        <bem.FormModal__item m='import-data'>
          <div className='connect-projects-header'>
            <i className="k-icon k-icon-folder-in"/>
            <h2>{t('Import other project data')}</h2>
          </div>
          <p>
            {t('Connect with other project(s) to import dynamic data from them into this project. Learn more about dynamic data attachments')}
            <a href='#'>{t(' ' + 'here')}</a>
          </p>
          {/* Selecting project form*/}
          {sharingEnabledAssets &&
            <div className='import-data-form'>
              {this.renderSelect(sharingEnabledAssets)}
              <TextBox
                placeholder={t('Give a unique name to the import')}
                value={this.state.newFilename}
                onChange={this.onFilenameChange}
                errors={this.state.fieldsErrors.emptyFilename ||
                        this.state.fieldsErrors.filename}
              />
              <bem.KoboButton m='blue'>
                {t('Import')}
              </bem.KoboButton>
            </div>
          }

          {/* Display attached projects */}
          <ul>
            <label>{t('Imported')}</label>
            {(this.state.isVirgin || this.state.isLoading) &&
              <div className='imported-item'>
                {this.renderLoading(t('Loading imported projects'))}
              </div>
            }
            {!this.state.isLoading && this.state.attachedParents.length == 0 &&
              <li className='no-imports'>
                {t('No data imported')}
              </li>
            }
            {!this.state.isLoading && this.state.attachedParents.length > 0 &&
                this.state.attachedParents.map((item, n) => {
                  return (
                    <li key={n} className='imported-item'>
                      <i className="k-icon k-icon-check"/>
                      <div className='imported-names'>
                        <span className='imported-filename'>
                          {truncateFile(item.filename, MAX_DISPLAYED_STRING_LENGTH)}
                        </span>
                        <span className='imported-parent'>
                          {truncateString(item.parentName, MAX_DISPLAYED_STRING_LENGTH)}
                        </span>
                      </div>
                      <i
                        className="k-icon-trash"
                        onClick={() => this.removeAttachment(item.attachmentUrl)}
                      />
                    </li>
                  );
                })
            }
          </ul>
        </bem.FormModal__item>

      </bem.FormModal__form>
    );
  }
}

export default ConnectProjects;
