import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import KoboTagsInput from 'js/components/common/koboTagsInput';
import bem from 'js/bem';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {notify} from 'utils';
import LoadingSpinner from 'js/components/common/loadingSpinner';

/**
 * @param {Object} asset - Modal asset.
 */
export class AssetTagsForm extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isSessionLoaded: !!stores.session.isLoggedIn,
      tags: this.props.asset?.tag_string || '',
      isPending: false,
    };

    this.unlisteners = [];

    autoBind(this);
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
      {tag_string: this.state.tags}
    );
  }

  onTagsChange(newValue) {
    this.setState({tags: newValue});
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
      return (<LoadingSpinner/>);
    }

    return (
      <bem.FormModal__form className='project-settings'>
        <bem.FormModal__item m='wrapper' disabled={this.state.isPending}>
          <bem.FormModal__item>
            <KoboTagsInput
              tags={this.state.tags}
              onChange={this.onTagsChange}
            />
          </bem.FormModal__item>
        </bem.FormModal__item>

        <bem.Modal__footer>
          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={this.state.isPending}
          >
            {this.getSubmitButtonLabel()}
          </bem.KoboButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
}

reactMixin(AssetTagsForm.prototype, Reflux.ListenerMixin);
