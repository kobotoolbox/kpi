import React from 'react';
import autoBind from 'react-autobind';
import TagsInput from 'react-tagsinput';
import Select from 'react-select';
import TextareaAutosize from 'react-autosize-textarea';
import TextBox from 'js/components/textBox';
import Checkbox from 'js/components/checkbox';
import stores from 'js/stores';
import bem from 'js/bem';
import {t} from 'js/utils';

/**
 * @typedef {Object} TemplateData
 * @property {string} name
 * @property {string} organization
 * @property {string|null} country
 * @property {string|null} primarySector
 * @property {string[]} tags
 * @property {string} description
 * @property {boolean} makePublic
 */

/**
 * Properties:
 * props.data {TemplateData}
 * props.onChange {function}
 */
class LibraryTemplateForm extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  onPropertyChange(property, newValue) {
    this.props.onChange(property, newValue);
  }

  onNameChange(newValue) {this.onPropertyChange('name', newValue);}
  onOrganizationChange(newValue) {this.onPropertyChange('organization', newValue);}
  onCountryChange(newValue) {this.onPropertyChange('country', newValue);}
  onPrimarySectorChange(newValue) {this.onPropertyChange('primarySector', newValue);}
  onTagsChange(newValue) {this.onPropertyChange('tags', newValue);}
  onDescriptionChange(evt) {this.onPropertyChange('description', evt.target.value);}
  onMakePublicChange(newValue) {this.onPropertyChange('makePublic', newValue);}

  render() {
    const sectors = stores.session.currentAccount.available_sectors;
    const countries = stores.session.currentAccount.available_countries;

    return (
      <bem.FormModal__item m='wrapper'>
        <bem.FormModal__item>
          <TextBox
            value={this.props.data.name}
            onChange={this.onNameChange}
            label={t('Name') + '*'}
          />
        </bem.FormModal__item>

        <bem.FormModal__item>
          <TextBox
            value={this.props.data.organization}
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
            value={this.props.data.country}
            onChange={this.onCountryChange}
            options={countries}
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
            value={this.props.data.primarySector}
            onChange={this.onPrimarySectorChange}
            options={sectors}
            className='kobo-select'
            classNamePrefix='kobo-select'
            menuPlacement='auto'
            isClearable
          />
        </bem.FormModal__item>

        <bem.FormModal__item>
          <TagsInput
            value={this.props.data.tags}
            onChange={this.onTagsChange}
            inputProps={{placeholder: t('Tags')}}
          />
        </bem.FormModal__item>

        <bem.FormModal__item>
          <TextareaAutosize
            onChange={this.onDescriptionChange}
            value={this.props.data.description}
            placeholder={t('Enter short description here')}
          />
        </bem.FormModal__item>

        <bem.FormModal__item>
          <Checkbox
            checked={this.props.data.makePublic}
            onChange={this.onMakePublicChange}
            label={t('Make Public')}
          />
        </bem.FormModal__item>
      </bem.FormModal__item>
    );
  }
}

export default LibraryTemplateForm;
