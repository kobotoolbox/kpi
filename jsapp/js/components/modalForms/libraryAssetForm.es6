import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import KoboTagsInput from 'js/components/common/koboTagsInput';
import Select from 'react-select';
import PropTypes from 'prop-types';
import TextBox from 'js/components/common/textBox';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import TextareaAutosize from 'react-autosize-textarea';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {hashHistory} from 'react-router';
import {notify} from 'utils';
import assetUtils from 'js/assetUtils';
import {
  renderBackButton
} from './modalHelpers';
import {ASSET_TYPES} from 'js/constants';
import mixins from 'js/mixins';
import ownedCollectionsStore from 'js/components/library/ownedCollectionsStore';
import envStore from 'js/envStore';

/**
 * Modal for creating or updating library asset (collection or template)
 *
 * @prop {Object} asset - Modal asset.
 */
export class LibraryAssetForm extends React.Component {
  constructor(props) {
    super(props);
    this.unlisteners = [];
    this.state = {
      isSessionLoaded: !!stores.session.isLoggedIn,
      data: {
        name: '',
        organization: '',
        country: null,
        sector: null,
        tags: '',
        description: ''
      },
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
      actions.resources.createResource.completed.listen(this.onCreateResourceCompleted.bind(this)),
      actions.resources.createResource.failed.listen(this.onCreateResourceFailed.bind(this)),
      actions.resources.updateAsset.completed.listen(this.onUpdateAssetCompleted.bind(this)),
      actions.resources.updateAsset.failed.listen(this.onUpdateAssetFailed.bind(this))
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  applyPropsData() {
    if (this.props.asset.name) {
      this.state.data.name = this.props.asset.name;
    }
    if (this.props.asset.settings.organization) {
      this.state.data.organization = this.props.asset.settings.organization;
    }
    if (this.props.asset.settings.country) {
      this.state.data.country = this.props.asset.settings.country;
    }
    if (this.props.asset.settings.sector) {
      this.state.data.sector = this.props.asset.settings.sector;
    }
    if (this.props.asset.tag_string) {
      this.state.data.tags = this.props.asset.tag_string;
    }
    if (this.props.asset.settings.description) {
      this.state.data.description = this.props.asset.settings.description;
    }
  }

  onCreateResourceCompleted(response) {
    this.setState({isPending: false});
    notify(t('##type## ##name## created').replace('##type##', this.getFormAssetType()).replace('##name##', response.name));
    stores.pageState.hideModal();
    if (this.getFormAssetType() === ASSET_TYPES.collection.id) {
      hashHistory.push(`/library/asset/${response.uid}`);
    } else if (this.getFormAssetType() === ASSET_TYPES.template.id) {
      hashHistory.push(`/library/asset/${response.uid}/edit`);
    }
  }

  onCreateResourceFailed() {
    this.setState({isPending: false});
    notify(t('Failed to create ##type##').replace('##type##', this.getFormAssetType()), 'error');
  }

  onUpdateAssetCompleted() {
    this.setState({isPending: false});
    stores.pageState.hideModal();
  }

  onUpdateAssetFailed() {
    this.setState({isPending: false});
    notify(t('Failed to update ##type##').replace('##type##', this.getFormAssetType()), 'error');
  }

  onSubmit(evt) {
    evt.preventDefault();
    this.setState({isPending: true});

    if (this.props.asset) {
      actions.resources.updateAsset(
        this.props.asset.uid,
        {
          name: this.state.data.name,
          settings: JSON.stringify({
            organization: this.state.data.organization,
            country: this.state.data.country,
            sector: this.state.data.sector,
            description: this.state.data.description
          }),
          tag_string: this.state.data.tags,
        }
      );
    } else {
      const params = {
        name: this.state.data.name,
        asset_type: this.getFormAssetType(),
        settings: JSON.stringify({
          organization: this.state.data.organization,
          country: this.state.data.country,
          sector: this.state.data.sector,
          description: this.state.data.description
        }),
        tag_string: this.state.data.tags,
      };

      if (
        this.isLibrarySingle() &&
        params.asset_type !== ASSET_TYPES.collection.id
      ) {
        const found = ownedCollectionsStore.find(this.currentAssetID());
        if (found && found.asset_type === ASSET_TYPES.collection.id) {
          // when creating from within a collection page, make the new asset
          // a child of this collection
          params.parent = found.url;
        }
      }

      actions.resources.createResource(params);
    }
  }

  onPropertyChange(property, newValue) {
    const data = this.state.data;
    data[property] = newValue;
    this.setState({data: data});
  }

  onNameChange(newValue) {this.onPropertyChange('name', assetUtils.removeInvalidChars(newValue));}
  onOrganizationChange(newValue) {this.onPropertyChange('organization', newValue);}
  onCountryChange(newValue) {this.onPropertyChange('country', newValue);}
  onSectorChange(newValue) {this.onPropertyChange('sector', newValue);}
  onTagsChange(newValue) {this.onPropertyChange('tags', newValue);}
  onDescriptionChange(evt) {this.onPropertyChange('description', assetUtils.removeInvalidChars(evt.target.value));}

  /**
   * @returns existing asset type or desired asset type
   */
  getFormAssetType() {
    return this.props.asset ? this.props.asset.asset_type : this.props.assetType;
  }

  isSubmitEnabled() {
    return !this.state.isPending;
  }

  getSubmitButtonLabel() {
    if (this.props.asset) {
      if (this.state.isPending) {
        return t('Saving…');
      } else {
        return t('Save');
      }
    } else if (this.state.isPending) {
      return t('Creating…');
    } else {
      return t('Create');
    }
  }

  render() {
    if (!this.state.isSessionLoaded || !envStore.isReady) {
      return (<LoadingSpinner/>);
    }

    const SECTORS = envStore.data.available_sectors;
    const COUNTRIES = envStore.data.available_countries;

    return (
      <bem.FormModal__form className='project-settings'>
        <bem.FormModal__item m='wrapper' disabled={this.state.isPending}>
          <bem.FormModal__item>
            <TextBox
              value={this.state.data.name}
              onChange={this.onNameChange}
              label={t('Name')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextBox
              value={this.state.data.organization}
              onChange={this.onOrganizationChange}
              label={t('Organization')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <label htmlFor='country'>
              {t('Country')}
            </label>

            <Select
              id='country'
              value={this.state.data.country}
              onChange={this.onCountryChange}
              options={COUNTRIES}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
              isClearable
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <label htmlFor='sector'>
              {t('Primary Sector')}
            </label>

            <Select
              id='sector'
              value={this.state.data.sector}
              onChange={this.onSectorChange}
              options={SECTORS}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
              isClearable
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <KoboTagsInput
              tags={this.state.data.tags}
              onChange={this.onTagsChange}
              label={t('Tags')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextareaAutosize
              onChange={this.onDescriptionChange}
              value={this.state.data.description}
              placeholder={t('Enter short description here')}
            />
          </bem.FormModal__item>
        </bem.FormModal__item>

        <bem.Modal__footer>
          {renderBackButton(this.state.isPending)}

          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={!this.isSubmitEnabled()}
          >
            {this.getSubmitButtonLabel()}
          </bem.KoboButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
}

reactMixin(LibraryAssetForm.prototype, Reflux.ListenerMixin);
reactMixin(LibraryAssetForm.prototype, mixins.contextRouter);

LibraryAssetForm.contextTypes = {
  router: PropTypes.object
};
