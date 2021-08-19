import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import classNames from 'classnames';
import Select from 'react-select';
import alertify from 'alertifyjs';
import {stores} from '../../stores';
import {actions} from '../../actions';
import {notify} from 'utils';

class CopyTeamPermissions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isAwaitingAssetChange: false,
      isCopyFormVisible: false,
      sourceUid: null,
      sourceName: null,
      targetUid: this.props.uid,
      targetName: stores.allAssets.byUid[this.props.uid].name
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetChange);
    this.listenTo(actions.permissions.copyPermissionsFrom.completed, this.onPermissionsCopied);
  }

  onPermissionsCopied() {
    notify(t('permissions were copied successfully'));
  }

  onAssetChange(data) {
    if (data[this.state.targetUid] && this.state.isAwaitingAssetChange) {
      this.setState({
        isAwaitingAssetChange: false,
        isCopyFormVisible: false
      });
    }
  }

  toggleCopyForm() {
    this.setState({ isCopyFormVisible: !this.state.isCopyFormVisible });
  }

  getSelectedProjectOption() {
    if (this.state.sourceUid) {
      return {
        value: this.state.sourceUid,
        label: this.state.sourceName
      };
    } else {
      return false;
    }
  }

  onSelectedProjectChange(asset) {
    if (asset !== null) {
      this.setState({
        sourceUid: asset.value,
        sourceName: stores.allAssets.byUid[asset.value].name
      });
    }
  }

  safeCopyPermissionsFrom() {
    if (this.state.sourceUid) {
      const dialog = alertify.dialog('confirm');
      const finalMessage = t('You are about to copy permissions from ##source to ##target. This action cannot be undone.')
        .replace('##source', `<strong>${this.state.sourceName}</strong>`)
        .replace('##target', `<strong>${this.state.targetName}</strong>`);
      let dialogOptions = {
        title: t('Are you sure you want to copy permissions?'),
        message: finalMessage,
        labels: { ok: t('Proceed'), cancel: t('Cancel') },
        onok: () => {
          this.setState({ isAwaitingAssetChange: true });
          actions.permissions.copyPermissionsFrom(
            this.state.sourceUid,
            this.state.targetUid
          );
        },
        oncancel: () => {
          dialog.destroy();
        }
      };
      dialog.set(dialogOptions).show();
    }
  }

  render() {
    let isImportButtonEnabled =
      this.state.sourceUid !== null && !this.state.isAwaitingAssetChange;

    const availableOptions = [];
    for (const assetUid in stores.allAssets.byUid) {
      if (stores.allAssets.byUid.hasOwnProperty(assetUid)) {
        // because choosing itself doesn't make sense
        if (assetUid !== this.state.targetUid) {
          availableOptions.push({
            value: assetUid,
            label: stores.allAssets.byUid[assetUid].name || t('Unlabelled')
          });
        }
      }
    }

    const rootButtonClasses = classNames(
      'copy-team-permissions',
      this.state.isCopyFormVisible ? 'copy-team-permissions--opened' : ''
    );

    return (
      <bem.FormModal__item className={rootButtonClasses}>
        <button
          className='copy-team-permissions-opener'
          onClick={this.toggleCopyForm}
        >
          {t('Copy team from another project')}

          <i className='k-icon k-icon-next'/>
        </button>

        {this.state.isCopyFormVisible && (
          <bem.FormView__cell>
            <bem.FormModal__item>
              {t('This will overwrite any existing sharing settings defined in this project.')}
            </bem.FormModal__item>

            <bem.FormModal__item m={['gray-row', 'flexed-row', 'copy-team-permissions']}>
              <Select
                id='teamPermissions'
                ref='sourceUid'
                value={this.getSelectedProjectOption()}
                isClearable={false}
                placeholder={t('Select source project…')}
                options={availableOptions}
                onChange={this.onSelectedProjectChange}
                className='kobo-select'
                classNamePrefix='kobo-select'
                menuPlacement='auto'
              />
              <bem.KoboButton
                id='copyTeamPermissionsImportButton'
                m='blue'
                disabled={!isImportButtonEnabled}
                onClick={this.safeCopyPermissionsFrom}
              >
                {t('copy')}
              </bem.KoboButton>
            </bem.FormModal__item>
          </bem.FormView__cell>
        )}
      </bem.FormModal__item>
    );
  }
}

reactMixin(CopyTeamPermissions.prototype, Reflux.ListenerMixin);

export default CopyTeamPermissions;
