import React from 'react';
import bem from 'js/bem';
import classNames from 'classnames';
import type {SingleValue} from 'react-select';
import alertify from 'alertifyjs';
import {stores} from '../../stores';
import assetStore from 'js/assetStore';
import type {AssetStoreData} from 'js/assetStore';
import {actions} from '../../actions';
import {notify, escapeHtml} from 'js/utils';
import Button from 'js/components/common/button';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';

interface CopyTeamPermissionsProps {
  assetUid: string;
}

interface CopyTeamPermissionsState {
  isAwaitingAssetChange: boolean;
  isCopyFormVisible: boolean;
  sourceUid: string | null;
  sourceName: string | null;
  targetUid: string;
  targetName: string;
}

export default class CopyTeamPermissions extends React.Component<
  CopyTeamPermissionsProps,
  CopyTeamPermissionsState
> {
  constructor(props: CopyTeamPermissionsProps) {
    super(props);
    this.state = {
      isAwaitingAssetChange: false,
      isCopyFormVisible: false,
      sourceUid: null,
      sourceName: null,
      targetUid: this.props.assetUid,
      targetName: stores.allAssets.byUid[this.props.assetUid].name,
    };
  }

  componentDidMount() {
    assetStore.listen(this.onAssetChange, this);
    actions.permissions.copyPermissionsFrom.completed.listen(
      this.onPermissionsCopied.bind(this)
    );
  }

  onPermissionsCopied() {
    notify(t('permissions were copied successfully'));
  }

  onAssetChange(data: AssetStoreData) {
    if (data[this.state.targetUid] && this.state.isAwaitingAssetChange) {
      this.setState({
        isAwaitingAssetChange: false,
        isCopyFormVisible: false,
      });
    }
  }

  toggleCopyForm() {
    this.setState({isCopyFormVisible: !this.state.isCopyFormVisible});
  }

  onSelectedProjectChange(newSelectedOption: string | null) {
    if (newSelectedOption !== null) {
      this.setState({
        sourceUid: newSelectedOption,
        sourceName: stores.allAssets.byUid[newSelectedOption].name,
      });
    }
  }

  safeCopyPermissionsFrom() {
    if (
      this.state.sourceUid &&
      this.state.sourceName &&
      this.state.targetName
    ) {
      const dialog = alertify.dialog('confirm');
      const finalMessage = t(
        'You are about to copy permissions from ##source to ##target. This action cannot be undone.'
      )
        .replace(
          '##source',
          `<strong>${escapeHtml(this.state.sourceName)}</strong>`
        )
        .replace(
          '##target',
          `<strong>${escapeHtml(this.state.targetName)}</strong>`
        );
      const dialogOptions = {
        title: t('Are you sure you want to copy permissions?'),
        message: finalMessage,
        labels: {ok: t('Proceed'), cancel: t('Cancel')},
        onok: () => {
          this.setState({isAwaitingAssetChange: true});
          actions.permissions.copyPermissionsFrom(
            this.state.sourceUid,
            this.state.targetUid
          );
        },
        oncancel: () => {
          dialog.destroy();
        },
      };
      dialog.set(dialogOptions).show();
    }
  }

  render() {
    const isImportButtonEnabled =
      this.state.sourceUid !== null && !this.state.isAwaitingAssetChange;

    const availableOptions: KoboSelectOption[] = [];
    for (const assetUid in stores.allAssets.byUid) {
      if (stores.allAssets.byUid.hasOwnProperty(assetUid)) {
        // because choosing itself doesn't make sense
        if (assetUid !== this.state.targetUid) {
          availableOptions.push({
            value: assetUid,
            label: stores.allAssets.byUid[assetUid].name || t('Unlabelled'),
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
          onClick={this.toggleCopyForm.bind(this)}
        >
          {t('Copy team from another project')}

          <i className='k-icon k-icon-angle-right' />
        </button>

        {this.state.isCopyFormVisible && (
          <bem.FormView__cell>
            <bem.FormModal__item>
              {t(
                'This will overwrite any existing sharing settings defined in this project.'
              )}
            </bem.FormModal__item>

            <bem.FormModal__item
              m={['gray-row', 'flexed-row', 'copy-team-permissions']}
            >
              <KoboSelect
                name='copy-team-permissions'
                type='outline'
                size='l'
                isSearchable
                options={availableOptions}
                selectedOption={this.state.sourceUid}
                onChange={this.onSelectedProjectChange.bind(this)}
                placeholder={t('Select source project…')}
                placement='up-center'
              />

              <Button
                type='primary'
                size='l'
                label={t('copy')}
                onClick={this.safeCopyPermissionsFrom.bind(this)}
                isDisabled={!isImportButtonEnabled}
              />
            </bem.FormModal__item>
          </bem.FormView__cell>
        )}
      </bem.FormModal__item>
    );
  }
}
