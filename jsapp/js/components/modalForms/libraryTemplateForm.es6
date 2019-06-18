import React from 'react';
import PropTypes from 'prop-types';
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
import {hashHistory} from 'react-router';
import {
  renderLoading,
  renderBackButton
} from './modalHelpers';
import {t} from 'js/utils';

class LibraryTemplateForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isSessionLoaded: !!stores.session.currentAccount,
      templateData: {
        name: '',
        organization: '',
        country: null,
        sector: null,
        tags: [],
        description: '',
        isPublic: false
      },
      isPending: false
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.session, () => {
      this.setState({isSessionLoaded: true});
    });
  }

  goToAssetEditor(assetUid) {
    stores.pageState.hideModal();
    hashHistory.push(`/library/asset/${assetUid}/edit`);
  }

  onPropertyChange(property, newValue) {
    const templateData = this.state.templateData;
    templateData[property] = newValue;
    this.setState({templateData: templateData});
  }

  onNameChange(newValue) {this.onPropertyChange('name', newValue);}
  onOrganizationChange(newValue) {this.onPropertyChange('organization', newValue);}
  onCountryChange(newValue) {this.onPropertyChange('country', newValue);}
  onSectorChange(newValue) {this.onPropertyChange('sector', newValue);}
  onTagsChange(newValue) {this.onPropertyChange('tags', newValue);}
  onDescriptionChange(evt) {this.onPropertyChange('description', evt.target.value);}
  onIsPublicChange(newValue) {this.onPropertyChange('isPublic', newValue);}

  goBack() {
    stores.pageState.switchModal({
      type: stores.pageState.state.modal.previousType,
    });
  }

  render() {
    if (!this.state.isSessionLoaded) {
      return renderLoading();
    }

    const SECTORS = stores.session.currentAccount.available_sectors;
    const COUNTRIES = stores.session.currentAccount.available_countries;

    return (
      <bem.FormModal__form className='project-settings'>
        <bem.FormModal__item m='wrapper'>
          <bem.FormModal__item>
            <TextBox
              value={this.state.templateData.name}
              onChange={this.onNameChange}
              label={t('Name') + '*'}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextBox
              value={this.state.templateData.organization}
              onChange={this.onOrganizationChange}
              label={t('Organization') + '*'}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <label htmlFor='country'>
              {t('Country')}
            </label>

            <Select
              id='country'
              value={this.state.templateData.country}
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
              {t('Primary Sector') + '*'}
            </label>

            <Select
              id='sector'
              value={this.state.templateData.sector}
              onChange={this.onSectorChange}
              options={SECTORS}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
              isClearable
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TagsInput
              value={this.state.templateData.tags}
              onChange={this.onTagsChange}
              inputProps={{placeholder: t('Tags')}}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <TextareaAutosize
              onChange={this.onDescriptionChange}
              value={this.state.templateData.description}
              placeholder={t('Enter short description here')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <Checkbox
              checked={this.state.templateData.isPublic}
              onChange={this.onIsPublicChange}
              label={t('Make Public')}
            />
          </bem.FormModal__item>
        </bem.FormModal__item>

        <bem.Modal__footer>
          {renderBackButton(this.state.isPending)}

          <bem.Modal__footerButton
            m='primary'
            type='submit'
            onClick={this.createTemplate}
            disabled={this.state.isPending}
            className='mdl-js-button'
          >
            {this.state.isPending ? t('Creating…') : t('Create')}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
}

reactMixin(LibraryTemplateForm.prototype, Reflux.ListenerMixin);

LibraryTemplateForm.contextTypes = {
  router: PropTypes.object
};

export default LibraryTemplateForm;
