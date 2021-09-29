import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {removeInvalidChars, getAssetDisplayName} from 'js/assetUtils';
import {
  KEY_CODES,
  NAME_MAX_LENGTH,
  ASSET_TYPES
} from 'js/constants';

/**
 * @prop {object} asset
 * @prop {boolean} isEditable
 */
class HeaderTitleEditor extends React.Component {
  constructor(props){
    super(props);
    this.typingTimer = null;
    this.state = {
      name: this.props.asset.name,
      isPending: false
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetLoad);
  }

  onAssetLoad() {
    this.setState({
      name: this.props.asset.name,
      isPending: false
    });
  }

  updateAssetTitle() {
    // surveys are required to have name
    if (!this.state.name.trim() && this.props.asset.asset_type === ASSET_TYPES.survey.id) {
      alertify.error(t('Please enter a title for your ##type##').replace('##type##', ASSET_TYPES[this.props.asset.asset_type].label));
      return false;
    } else {
      this.setState({isPending: true});
      actions.resources.updateAsset(
        this.props.asset.uid,
        {name: this.state.name}
      );
      return true;
    }
  }

  assetTitleChange(evt) {
    this.setState({name: removeInvalidChars(evt.target.value)});
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(this.updateAssetTitle.bind(this), 1500);
  }

  assetTitleKeyDown(evt) {
    if (evt.keyCode === KEY_CODES.ENTER) {
      clearTimeout(this.typingTimer);
      if (this.updateAssetTitle()) {
        evt.currentTarget.blur();
      }
    }
  }

  render() {
    const modifiers = [];
    if (
      typeof this.state.name === 'string' &&
      this.state.name.length > 125
    ) {
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
          placeholder = t('untitled ##type##').replace('##type##', ASSET_TYPES[this.props.asset.asset_type].label);
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

reactMixin(HeaderTitleEditor.prototype, Reflux.ListenerMixin);

export default HeaderTitleEditor;
