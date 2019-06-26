import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import stores from 'js/stores';
import actions from 'js/actions';
import {t} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';

class HeaderTitleEditor extends React.Component {
  constructor(props){
    super(props);
    this.typingTimer = null;
    this.state = {
      name: this.props.name,
      isPending: false
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetLoad);
  }

  onAssetLoad() {
    this.setState({isPending: false});
  }

  updateAssetTitle() {
    if (!this.state.name.trim()) {
      alertify.error(t('Please enter a title for your ##type##').replace('##type##', ASSET_TYPES[this.props.type].label));
      return false;
    } else {
      this.setState({isPending: true});
      actions.resources.updateAsset(
        this.props.uid,
        {name: this.state.name}
      );
      return true;
    }
  }

  assetTitleChange(evt) {
    this.setState({name: evt.target.value});
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(this.updateAssetTitle.bind(this), 1500);
  }

  assetTitleKeyDown(evt) {
    if (evt.key === 'Enter') {
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
    switch (this.props.type) {
      case ASSET_TYPES.question.id:
        placeholder = t('Question title');
        break;
      case ASSET_TYPES.block.id:
        placeholder = t('Block title');
        break;
      case ASSET_TYPES.template.id:
        placeholder = t('Template title');
        break;
      case ASSET_TYPES.survey.id:
        placeholder = t('Project title');
        break;
    }

    return (
      <bem.MainHeader__title m={modifiers}>
        <input
          type='text'
          name='title'
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
