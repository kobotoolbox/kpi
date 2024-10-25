import React from 'react';
import autoBind from 'react-autobind';
import {notify} from 'js/utils';
import bem from 'js/bem';
import assetStore from 'js/assetStore';
import {actions} from 'js/actions';
import {removeInvalidChars, getAssetDisplayName} from 'js/assetUtils';
import {KEY_CODES, NAME_MAX_LENGTH, ASSET_TYPES} from 'js/constants';
import type {AssetResponse} from 'jsapp/js/dataInterface';

interface HeaderTitleEditorProps {
  asset: AssetResponse;
  isEditable: boolean;
}

interface HeaderTitleEditorState {
  name: string;
  isPending: boolean;
}

class HeaderTitleEditor extends React.Component<
  HeaderTitleEditorProps,
  HeaderTitleEditorState
> {
  typingTimer?: NodeJS.Timeout;
  private unlisteners: Function[];

  constructor(props: HeaderTitleEditorProps) {
    super(props);
    this.state = {
      name: this.props.asset.name,
      isPending: false,
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    // Note: there is a risk/vulnerability in this component connected to
    // the usage of the `assetStore`. As `assetStore` is listening to
    // `actions.resources.loadAsset` which is using our faulty `assetCache`,
    // there is a chance `assetStore` would give us a cached (old) asset object.
    this.unlisteners.push(assetStore.listen(this.onAssetStoreUpdated, this));
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  onAssetStoreUpdated() {
    const foundAsset = assetStore.getAsset(this.props.asset.uid);
    if (foundAsset) {
      this.setState({
        name: foundAsset.name,
        isPending: false,
      });
    }
  }

  updateAssetTitle() {
    // surveys are required to have name
    if (
      !this.state.name.trim() &&
      this.props.asset.asset_type === ASSET_TYPES.survey.id
    ) {
      notify.error(
        t('Please enter a title for your ##type##').replace(
          '##type##',
          ASSET_TYPES[this.props.asset.asset_type].label
        )
      );
      return false;
    } else {
      this.setState({isPending: true});
      actions.resources.updateAsset(this.props.asset.uid, {
        name: this.state.name,
      });
      return true;
    }
  }

  assetTitleChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({name: removeInvalidChars(evt.target.value)});
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(this.updateAssetTitle.bind(this), 1500);
  }

  assetTitleKeyDown(evt: React.KeyboardEvent<HTMLInputElement>) {
    if (evt.keyCode === KEY_CODES.ENTER) {
      clearTimeout(this.typingTimer);
      if (this.updateAssetTitle()) {
        evt.currentTarget?.blur();
      }
    }
  }

  render() {
    const modifiers = [];
    if (typeof this.state.name === 'string' && this.state.name.length > 125) {
      modifiers.push('long');
    }

    let placeholder = '';
    const displayName = getAssetDisplayName(this.props.asset);
    switch (this.props.asset.asset_type) {
      case ASSET_TYPES.question.id:
      case ASSET_TYPES.block.id:
      case ASSET_TYPES.template.id:
        if (displayName.question) {
          placeholder = displayName.question;
        } else {
          placeholder = t('untitled ##type##').replace(
            '##type##',
            ASSET_TYPES[this.props.asset.asset_type].label
          );
        }
        break;
      case ASSET_TYPES.collection.id:
        placeholder = t('untitled collection');
        break;
      case ASSET_TYPES.survey.id:
        placeholder = t('project title');
        break;
    }

    return (
      <bem.MainHeader__title m={modifiers}>
        <input
          dir='auto'
          type='text'
          name='title'
          maxLength={NAME_MAX_LENGTH}
          placeholder={placeholder}
          value={this.state.name}
          onChange={this.assetTitleChange.bind(this)}
          onKeyDown={this.assetTitleKeyDown.bind(this)}
          disabled={!this.props.isEditable || this.state.isPending}
        />
      </bem.MainHeader__title>
    );
  }
}

export default HeaderTitleEditor;
