import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Select from 'react-select';
import ToggleSwitch from '../toggleSwitch';
import {actions} from '../../actions';
import {bem} from 'js/bem';

const XML_EXTERNAL = 'xml-external';

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
      attachedParent: null,
      sharingEnabledAssets: null,
    };

    autoBind(this);
  }

  /*
   * setup
   */

  componentDidMount() {
    actions.dataShare.getAttachedParent(this.props.asset.uid);
    actions.dataShare.getSharingEnabledAssets();

    actions.dataShare.getSharingEnabledAssets.completed.listen(this.onGetSharingEnabledAssetsCompleted);
    actions.dataShare.attachToParent.completed.listen(this.onAttachToParentCompleted);
    actions.dataShare.getAttachedParent.completed.listen(this.onGetAttachedParentCompleted);
    actions.dataShare.toggleDataSharing.completed.listen(this.onToggleDataSharingCompleted);
  }

  /*
   * action listeners
   */

  onAttachToParentCompleted(assetUid) {
    actions.dataShare.getAttachedParent(assetUid);
  }
  onGetAttachedParentCompleted(response) {
    this.setState({attachedParent: response});
  }
  onGetSharingEnabledAssetsCompleted(response) {
    this.setState({sharingEnabledAssets: response});
  }
  onToggleDataSharingCompleted() {
    this.setState({isShared: !this.state.isShared});
  }

  onAssetSelect(selectedAsset) {
    let filename = this.getExteralFilename();
    if (filename !== '') {
      var data = JSON.stringify({
        parent: selectedAsset.url,
        fields: [],
        filename: filename,
      });
      actions.dataShare.attachToParent(this.props.asset.uid, data);
    } else {
      alertify.error(t('An `xml-external` question must exist in form'));
    }
  }

  /*
   * Utilities
   */

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
        message: t('This will attach the full dataset from \"##ASSET_NAME##\" as a background XML file to this form. While not easily visbable, it is technically possible for anyone entering data to your form to retrieve and view this dataset. Do not use this feature if \"##ASSET_NAME##\" includes sensative data.').replaceAll('##ASSET_NAME##', this.props.asset.name),
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

  getSharingEnabledAssets() {
    // TODO: need endpoint to get all assets with data sharing enabled
  }

  getExteralFilename() {
    let filename = '';
    this.props.asset.content.survey.some((element) => {
      if (element.type === XML_EXTERNAL) {
        filename = element.name;
      }
    });
    console.dir(filename);
    return filename;
  }

  /*
   * rendering
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

  render() {
    const sharingEnabledAssets = this.state.sharingEnabledAssets?.results;

    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file connect-projects'>
        <bem.FormModal__item m='data-sharing'>
          <div className='connect-projects-header'>
            <i className="k-icon k-icon-folder-out"/>
            <h2>{t('Share data with other project forms')}</h2>
          </div>
          <p>
            {t('You can open this project to make the data collected here available in other forms. This data will be dynamic and will update automatically in the new forms you link when anything is modified in this project. You can change this at any time and customize who has access to this data.')}
          </p>
          {this.renderSwitchLabel()}
        </bem.FormModal__item>

        <bem.FormModal__item m='import-other'>
          <div className='connect-projects-header'>
            <i className="k-icon k-icon-folder-in"/>
            <h2>{t('Import other project data')}</h2>
          </div>
          <p>
            {t('You can also link available projects to this form, permitting data coming from the new proejct to be available in the form builder. In order to do this, you will need to introduce the appropriate code in the desired questions. You can learn more about it ')}
            <a href='#'>here</a>
            {t('.')}
          </p>
          {/* stores env variable used as placeholder for now */}
          {sharingEnabledAssets &&
            <Select
              placeholder={t('Select a different project to import data from')}
              options={sharingEnabledAssets}
              getOptionLabel={option => option.name}
              getOptionValue={option => option.url}
              onChange={this.onAssetSelect.bind(this)}
              className='kobo-select'
              classNamePrefix='kobo-select'
            />
          }
          {this.state.attachedParent &&
            <ul>
              <label>{t('Imported')}</label>
              <li className='imported-item'>
                  <i className="k-icon k-icon-check"/>
                <span>{this.state.attachedParent.name}</span>
              </li>
            </ul>
          }

        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }
}

export default ConnectProjects;
