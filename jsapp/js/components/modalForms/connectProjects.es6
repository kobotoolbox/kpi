import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Select from 'react-select';
import ToggleSwitch from '../toggleSwitch';
import {actions} from '../../actions';
import {bem} from 'js/bem';
import {stores} from 'js/stores';

/*
 * Modal for uploading form media
 */
class ConnectProjects extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isVirgin: true,
      isLoading: false,
      isShared: false,
    };

    autoBind(this);
  }

  /*
   * setup
   */

  componentDidMount() {
    actions.dataShare.getSharedData.completed.listen(this.onGetSharedDataCompleted);
    actions.dataShare.enableDataSharing.completed.listen(this.onEnableDataSharingCompleted);
    actions.dataShare.disableDataSharing.completed.listen(this.onDisableDataSharingCompleted);
  }

  /*
   * action listeners
   */
  onGetSharedDataCompleted() {
    // TODO
  }
  onEnableDataSharingCompleted() {
    // TODO
  }
  onDisableDataSharingCompleted() {
    // TODO
  }
  /*
   * Utilities
   */
  toggleSharingData() {
    if (!this.state.isShared) {
      let dialog = alertify.dialog('confirm');
      let opts = {
        title: `${t('Privacy Notice')}`,
        message: t('This will attach the full dataset from \"##ASSET_NAME##\" as a background XML file to this form. While not easily visbable, it is technically possible for anyone entering data to your form to retrieve and view this dataset. Do not use this feature if \"##ASSET_NAME##\" includes sensative data.').replaceAll('##ASSET_NAME##', this.props.asset.name),
        labels: {ok: t('Acknowledge and continue'), cancel: t('Cancel')},
        onok: (evt, value) => {
          // TODO: set up api action depending on current shared status
          dialog.destroy();
          this.setState({isShared: !this.state.isShared});
        },
        oncancel: () => {
          dialog.destroy();
        }
      };
      dialog.set(opts).show();
    } else {
      this.setState({isShared: !this.state.isShared});
    }
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
    const tempListForDisplay = [
      'One of my forms',
      'Made in 2021 or so',
      'Happy New Year'
    ];
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
          <Select
            placeholder={t('Select a different project to import data from')}
            options={stores.session.environment.available_countries}
            className='kobo-select'
            classNamePrefix='kobo-select'
          />
          <ul>
            <label>{t('Imported')}</label>
            {tempListForDisplay.map((item, n) => {
              return(
                <li key={n} className='imported-item'>
                  <i class="k-icon k-icon-check"/>
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>

        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }
}

export default ConnectProjects;
