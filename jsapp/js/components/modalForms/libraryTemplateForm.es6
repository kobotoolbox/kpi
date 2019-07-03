import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import TagsInput from 'react-tagsinput';
import Select from 'react-select';
import TextBox from 'js/components/textBox';
import Checkbox from 'js/components/checkbox';
import bem from 'js/bem';
import TextareaAutosize from 'react-autosize-textarea';
import stores from 'js/stores';
import actions from 'js/actions';
import {hashHistory} from 'react-router';
import {
  t,
  notify,
  anonUsername
} from 'js/utils';
import {
  renderLoading,
  renderBackButton,
  isLibraryAssetPublic,
  canMakeLibraryAssetPublic
} from './modalHelpers';

/**
 * @param {Object} asset - Modal asset.
 * @param {boolean} forceMakePublic - Used to check "Make Public" from the start, causing required properties to validate.
 */
export class LibraryTemplateForm extends React.Component {
  constructor(props) {
    super(props);
    this.unlisteners = [];
    this.state = {
      isSessionLoaded: !!stores.session.currentAccount,
      data: {
        name: '',
        organization: '',
        country: null,
        sector: null,
        tags: [],
        description: '',
        makePublic: false,
      },
      errors: {},
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
    if (this.props.asset.settings.tags) {
      this.state.data.tags = this.props.asset.settings.tags;
    }
    if (this.props.asset.settings.description) {
      this.state.data.description = this.props.asset.settings.description;
    }

    if (this.props.forceMakePublic) {
      this.state.data.makePublic = true;
    } else {
      this.state.data.makePublic = isLibraryAssetPublic(
        this.props.asset.permissions,
        this.props.asset.discoverable_when_public
      );
    }

    this.validate(false);
  }

  onCreateResourceCompleted(response) {
    this.setState({isPending: false});
    notify(t('Template ##name## created').replace('##name##', response.name));
    this.goToAssetEditor(response.uid);
  }

  onCreateResourceFailed() {
    this.setState({isPending: false});
    notify(t('Failed to create template'), 'error');
  }

  onUpdateAssetCompleted() {
    this.setState({isPending: false});
    stores.pageState.hideModal();
  }

  onUpdateAssetFailed() {
    this.setState({isPending: false});
    notify(t('Failed to update template'), 'error');
  }

  onSubmit() {
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
            tags: this.state.data.tags,
            description: this.state.data.description
          })
        }
      );

      // TODO: merge this change with above action to make single BE call
      if (
        isLibraryAssetPublic(
          this.props.asset.permissions,
          this.props.asset.discoverable_when_public
        ) === false &&
        this.state.data.makePublic === true
      ) {
        actions.permissions.assignPerm({
          username: anonUsername,
          uid: this.props.asset.uid,
          kind: this.props.asset.kind,
          objectUrl: this.props.asset.object_url,
          role: 'view'
        });
      }
    } else {
      actions.resources.createResource({
        name: this.state.data.name,
        asset_type: 'template',
        settings: JSON.stringify({
          organization: this.state.data.organization,
          country: this.state.data.country,
          sector: this.state.data.sector,
          tags: this.state.data.tags,
          description: this.state.data.description
        })
      });
    }
  }

  goToAssetEditor(assetUid) {
    stores.pageState.hideModal();
    hashHistory.push(`/library/asset/${assetUid}/edit`);
  }

  onPropertyChange(property, newValue) {
    const data = this.state.data;
    data[property] = newValue;
    this.setState({data: data});
    this.validate();
  }

  onNameChange(newValue) {this.onPropertyChange('name', newValue);}
  onOrganizationChange(newValue) {this.onPropertyChange('organization', newValue);}
  onCountryChange(newValue) {this.onPropertyChange('country', newValue);}
  onSectorChange(newValue) {this.onPropertyChange('sector', newValue);}
  onTagsChange(newValue) {this.onPropertyChange('tags', newValue);}
  onDescriptionChange(evt) {this.onPropertyChange('description', evt.target.value);}
  onIsPublicChange(newValue) {this.onPropertyChange('makePublic', newValue);}

  validate(async = true) {
    let errors = {};
    if (this.state.data.makePublic) {
      const validateResult = canMakeLibraryAssetPublic(
        this.state.data.name,
        this.state.data.organization,
        this.state.data.sector
      );
      if (validateResult !== true) {
        errors = validateResult;
      }
    }

    if (async) {
      this.setState({errors: errors});
    } else {
      this.state.errors = errors;
    }
  }

  isSubmitEnabled() {
    return (
      !this.state.isPending &&
      Object.keys(this.state.errors).length === 0
    );
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
    if (!this.state.isSessionLoaded) {
      return renderLoading();
    }

    const SECTORS = stores.session.environment.available_sectors;
    const COUNTRIES = stores.session.environment.available_countries;

    const sectorWrapperClassNames = ['kobo-select__wrapper'];
    if (this.state.errors.sector) {
      sectorWrapperClassNames.push('kobo-select__wrapper--error');
    }

    return (
      <bem.FormModal__form className='project-settings'>
        <bem.FormModal__item m='wrapper' disabled={this.state.isPending}>
          <bem.FormModal__item>
            <TextBox
              value={this.state.data.name}
              onChange={this.onNameChange}
              label={t('Name') + '*'}
              errors={this.state.errors.name}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextBox
              value={this.state.data.organization}
              onChange={this.onOrganizationChange}
              label={t('Organization') + '*'}
              errors={this.state.errors.organization}
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

          <bem.FormModal__item className={sectorWrapperClassNames.join(' ')}>
            <label htmlFor='sector'>
              {t('Primary Sector') + '*'}
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

            {this.state.errors.sector &&
              <div className='kobo-select-error'>{this.state.errors.sector}</div>
            }
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TagsInput
              value={this.state.data.tags}
              onChange={this.onTagsChange}
              inputProps={{placeholder: t('Tags')}}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextareaAutosize
              onChange={this.onDescriptionChange}
              value={this.state.data.description}
              placeholder={t('Enter short description here')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <Checkbox
              checked={this.state.data.makePublic}
              onChange={this.onIsPublicChange}
              label={t('Make Public') + ' ' + t('*required to be made public')}
            />
          </bem.FormModal__item>
        </bem.FormModal__item>

        <bem.Modal__footer>
          {renderBackButton(this.state.isPending)}

          <bem.Modal__footerButton
            m='primary'
            type='submit'
            onClick={this.onSubmit}
            disabled={!this.isSubmitEnabled()}
            className='mdl-js-button'
          >
            {this.getSubmitButtonLabel()}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
}

reactMixin(LibraryTemplateForm.prototype, Reflux.ListenerMixin);
