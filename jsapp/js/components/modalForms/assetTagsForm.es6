import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import TagsInput from 'react-tagsinput';
import {bem} from 'js/bem';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {notify} from 'utils';
import {cleanupTags} from 'js/assetUtils';
import {renderLoading} from './modalHelpers';

/**
 * @param {Object} asset - Modal asset.
 */
export class AssetTagsForm extends React.Component {
  constructor(props) {
    super(props);
    this.unlisteners = [];
    this.state = {
      isSessionLoaded: !!stores.session.currentAccount,
      tags: [],
      isPending: false
    };
    autoBind(this);
    if (this.props.asset) {
      this.applyPropsData();
    }
  }

  componentDidMount() {
    this.listenTo(stores.session, () => {
      this.setState({isSessionLoaded: true});
    });
    this.unlisteners.push(
      actions.resources.updateAsset.completed.listen(this.onUpdateAssetCompleted.bind(this)),
      actions.resources.updateAsset.failed.listen(this.onUpdateAssetFailed.bind(this))
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  applyPropsData() {
    if (this.props.asset.tag_string) {
      this.state.tags = this.props.asset.tag_string.split(',');
    }
  }

  onUpdateAssetCompleted() {
    this.setState({isPending: false});
    stores.pageState.hideModal();
  }

  onUpdateAssetFailed() {
    this.setState({isPending: false});
    notify(t('Failed to update tags'), 'error');
  }

  onSubmit(evt) {
    evt.preventDefault();
    this.setState({isPending: true});
    actions.resources.updateAsset(
      this.props.asset.uid,
      {tag_string: this.state.tags.join(',')}
    );
  }

  onTagsChange(newValue) {
    this.setState({tags: cleanupTags(newValue)});
  }

  getSubmitButtonLabel() {
    if (this.state.isPending) {
      return t('Updating…');
    } else {
      return t('Update');
    }
  }

  render() {
    if (!this.state.isSessionLoaded) {
      return renderLoading();
    }

    return (
      <bem.FormModal__form className='project-settings'>
        <bem.FormModal__item m='wrapper' disabled={this.state.isPending}>
          <bem.FormModal__item>
            <TagsInput
              value={this.state.tags}
              onChange={this.onTagsChange}
              inputProps={{placeholder: t('Tags')}}
            />
          </bem.FormModal__item>
        </bem.FormModal__item>

        <bem.Modal__footer>
          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={this.state.isPending}
            className='mdl-js-button'
          >
            {this.getSubmitButtonLabel()}
          </bem.KoboButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
}

reactMixin(AssetTagsForm.prototype, Reflux.ListenerMixin);
