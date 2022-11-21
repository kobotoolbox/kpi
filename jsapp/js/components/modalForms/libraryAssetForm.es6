import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import clonedeep from 'lodash.clonedeep';
import KoboTagsInput from 'js/components/common/koboTagsInput';
import WrappedSelect from 'js/components/common/wrappedSelect';
import PropTypes from 'prop-types';
import TextBox from 'js/components/common/textBox';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {hashHistory} from 'react-router';
import {notify} from 'utils';
import assetUtils from 'js/assetUtils';
import {renderBackButton} from './modalHelpers';
import {ASSET_TYPES} from 'js/constants';
import mixins from 'js/mixins';
import ownedCollectionsStore from 'js/components/library/ownedCollectionsStore';
import envStore from 'js/envStore';

/**
 * Modal for creating or updating library asset (collection or template)
 *
 * NOTE: We have multiple components with similar form:
 * - ProjectSettings
 * - AccountSettingsRoute
 * - LibraryAssetForm
 *
 * @prop {Object} asset - Modal asset.
 */
export class LibraryAssetForm extends React.Component {
  constructor(props) {
    super(props);
    this.unlisteners = [];
    this.state = {
      isSessionLoaded: !!stores.session.isLoggedIn,
      fields: {
        name: '',
        organization: '',
        country: null,
        sector: null,
        tags: '',
        description: '',
      },
      isPending: false,
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
      this.state.fields.name = this.props.asset.name;
    }
    if (this.props.asset.settings.organization) {
      this.state.fields.organization = this.props.asset.settings.organization;
    }
    if (this.props.asset.settings.country) {
      this.state.fields.country = this.props.asset.settings.country;
    }
    if (this.props.asset.settings.sector) {
      this.state.fields.sector = this.props.asset.settings.sector;
    }
    if (this.props.asset.tag_string) {
      this.state.fields.tags = this.props.asset.tag_string;
    }
    if (this.props.asset.settings.description) {
      this.state.fields.description = this.props.asset.settings.description;
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
          name: this.state.fields.name,
          settings: JSON.stringify({
            organization: this.state.fields.organization,
            country: this.state.fields.country,
            sector: this.state.fields.sector,
            description: this.state.fields.description,
          }),
          tag_string: this.state.fields.tags,
        }
      );
    } else {
      const params = {
        name: this.state.fields.name,
        asset_type: this.getFormAssetType(),
        settings: JSON.stringify({
          organization: this.state.fields.organization,
          country: this.state.fields.country,
          sector: this.state.fields.sector,
          description: this.state.fields.description,
        }),
        tag_string: this.state.fields.tags,
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

  onAnyFieldChange(fieldName, newFieldValue) {
    const fields = clonedeep(this.state.fields);
    fields[fieldName] = newFieldValue;
    this.setState({fields: fields});
  }

  onNameChange(newValue) {
    this.onAnyFieldChange('name', assetUtils.removeInvalidChars(newValue));
  }

  onDescriptionChange(newValue) {
    this.onAnyFieldChange('description', assetUtils.removeInvalidChars(newValue));
  }

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

    const SECTORS = envStore.data.sector_choices;
    const COUNTRIES = envStore.data.country_choices;

    return (
      <bem.FormModal__form className='project-settings'>
        <bem.FormModal__item m='wrapper' disabled={this.state.isPending}>
          <bem.FormModal__item>
            <TextBox
              customModifiers='on-white'
              value={this.state.fields.name}
              onChange={this.onNameChange.bind(this)}
              label={t('Name')}
              placeholder={t('Enter title of ##type## here').replace('##type##', this.getFormAssetType())}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextBox
              customModifiers='on-white'
              type='text-multiline'
              value={this.state.fields.description}
              onChange={this.onDescriptionChange.bind(this)}
              label={t('Description')}
              placeholder={t('Enter short description here')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextBox
              customModifiers='on-white'
              value={this.state.fields.organization}
              onChange={this.onAnyFieldChange.bind(this, 'organization')}
              label={t('Organization')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <WrappedSelect
              label={t('Primary Sector')}
              value={this.state.fields.sector}
              onChange={this.onAnyFieldChange.bind(this, 'sector')}
              options={SECTORS}
              isLimitedHeight
              isClearable
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <WrappedSelect
              label={t('Country')}
              isMulti
              value={this.state.fields.country}
              onChange={this.onAnyFieldChange.bind(this, 'country')}
              options={COUNTRIES}
              isLimitedHeight
              isClearable
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <KoboTagsInput
              tags={this.state.fields.tags}
              onChange={this.onAnyFieldChange.bind(this, 'tags')}
              label={t('Tags')}
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

LibraryAssetForm.contextTypes = {router: PropTypes.object};
