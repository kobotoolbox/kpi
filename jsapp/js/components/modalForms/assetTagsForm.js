import React from 'react';
import autoBind from 'react-autobind';
import {observer} from 'mobx-react';
import KoboTagsInput from 'js/components/common/koboTagsInput';
import bem from 'js/bem';
import sessionStore from 'js/stores/session';
import {actions} from 'js/actions';
import {notify} from 'utils';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Button from 'js/components/common/button';
import pageState from 'js/pageState.store';

/**
 * @param {Object} asset - Modal asset.
 */
export const AssetTagsForm = observer(class AssetTagsForm extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      tags: this.props.asset?.tag_string || '',
      isPending: false,
    };

    this.unlisteners = [];

    autoBind(this);
  }

  componentDidMount() {
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
    pageState.hideModal();
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

  render() {
    if (!sessionStore.isLoggedIn) {
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
          <Button
            type='primary'
            size='l'
            isSubmit
            onClick={this.onSubmit.bind(this)}
            isPending={this.state.isPending}
            label={t('Update')}
          />
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
});
