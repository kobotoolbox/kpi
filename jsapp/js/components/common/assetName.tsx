import React from 'react';
import {getAssetDisplayName} from 'js/assetUtils';
import {hasLongWords} from 'js/textUtils';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
import './assetName.scss';

interface AssetNameProps {
  asset: AssetResponse | ProjectViewAsset;
  'data-cy'?: string;
}

/**
 * Displays the name of the asset. Works for any asset type and regardless if it
 * has a name or not.
 *
 * @prop {object} asset
 */
export default class AssetName extends React.Component<AssetNameProps> {
  render() {
    const displayName = getAssetDisplayName(this.props.asset);
    let extra = null;
    const classNames = ['asset-name'];

    if (
      !displayName.original &&
      displayName.question &&
      'summary' in this.props.asset &&
      this.props.asset.summary &&
      this.props.asset.summary.row_count
    ) {
      if (this.props.asset.summary.row_count === 2) {
        extra = <small>{t('and one other question')}</small>;
      } else if (this.props.asset.summary.row_count > 2) {
        extra = <small>{t('and ## other questions').replace('##', String(this.props.asset.summary.row_count - 1))}</small>;
      }
    }

    if (displayName.empty) {
      // if we display empty name fallback, we style it differently
      classNames.push('asset-name--empty');
    }

    if (hasLongWords(displayName.final)) {
      classNames.push('asset-name--has-long-words');
    }

    const additionalAttributes: {[attr: string]: string} = {};
    if (this.props['data-cy']) {
      additionalAttributes['data-cy'] = this.props['data-cy'];
    }

    return (
      <span className={classNames.join(' ')} {...additionalAttributes}>
        {displayName.final} {extra}
      </span>
    );
  }
}
