import React from 'react';
import {getAssetDisplayName} from 'js/assetUtils';
import {hasLongWords} from 'utils';
import './assetName.scss';

/**
 * Displays the name of the asset. Works for any asset type and regardless if it
 * has a name or not.
 *
 * @prop {object} asset
 */
export default class AssetName extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const displayName = getAssetDisplayName(this.props.asset);
    let extra = null;
    const classNames = ['asset-name'];
    const summary = this.props.asset.summary;

    if (
      !displayName.original &&
      displayName.question &&
      summary.row_count
    ) {
      if (summary.row_count === 2) {
        extra = <small>{t('and one other question')}</small>;
      } else if (summary.row_count > 2) {
        extra = <small>{t('and ## other questions').replace('##', summary.row_count - 1)}</small>;
      }
    }

    if (displayName.empty) {
      // if we display empty name fallback, we style it differently
      classNames.push('asset-name--empty');
    }

    if (hasLongWords(displayName.final)) {
      classNames.push('asset-name--has-long-words');
    }

    return (
      <span className={classNames.join(' ')}>
        {displayName.final} {extra}
      </span>
    );
  }
}
