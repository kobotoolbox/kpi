import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import TextBox from 'js/components/common/textBox';
import {
  getLangAsObject,
  toTitleCase
} from 'utils';

/*
Properties:
- langString <string>: follows pattern "Name (code)"
- langIndex <string>
- onLanguageChange <function>: required
- existingLanguages <langString[]>: for validation purposes
- isDefault <boolean>: for default language only
*/
class LanguageForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      nameError: null,
      code: '',
      codeError: null
    };

    if (this.props.langString) {
      const lang = getLangAsObject(this.props.langString);

      if (lang) {
        this.state = {
          name: lang.name || '',
          code: lang.code || ''
        };
      } else {
        // if language isn't in "English (en)" format, assume it is a simple language name string
        this.state = {
          name: this.props.langString,
          code: ''
        };
      }
    }

    autoBind(this);
  }
  isLanguageNameValid() {
    if (this.props.existingLanguages) {
      let isNameUnique = true;
      this.props.existingLanguages.forEach((langString) => {
        if (this.props.langString && langString === this.props.langString) {
          // skip comparing to itself (editing language context)
        } else if (langString !== null) {
          const langObj = getLangAsObject(langString);
          if (langObj && langObj.name === this.state.name) {
            isNameUnique = false;
          }
        }
      });
      return isNameUnique;
    } else {
      return true;
    }
  }
  isLanguageCodeValid() {
    if (this.props.existingLanguages) {
      let isCodeUnique = true;
      this.props.existingLanguages.forEach((langString) => {
        if (this.props.langString && langString === this.props.langString) {
          // skip comparing to itself (editing language context)
        } else if (langString !== null) {
          const langObj = getLangAsObject(langString);
          if (langObj && langObj.code === this.state.code) {
            isCodeUnique = false;
          }
        }
      });
      return isCodeUnique;
    } else {
      return true;
    }
  }
  onSubmit(evt) {
    evt.preventDefault();
    evt.currentTarget.disabled = true;

    const isNameValid = this.isLanguageNameValid();
    if (!isNameValid) {
      this.setState({nameError: t('Name must be unique!')});
      evt.currentTarget.disabled = false;
    } else {
      this.setState({nameError: null});
    }

    const isCodeValid = this.isLanguageCodeValid();
    if (!isCodeValid) {
      this.setState({codeError: t('Code must be unique!')});
      evt.currentTarget.disabled = false;
    } else {
      this.setState({codeError: null});
    }

    if (isNameValid && isCodeValid) {
      let langIndex = (this.props.isDefault) ? 0 : -1;
      if (this.props.langIndex !== undefined) {
        langIndex = this.props.langIndex;
      }
      this.props.onLanguageChange({
        name: this.state.name,
        code: this.state.code
      }, langIndex);
    }
  }
  onNameChange(newName) {
    this.setState({name: toTitleCase(newName.trim().toLowerCase())});
  }
  onCodeChange(newCode) {
    this.setState({code: newCode.trim().toLowerCase()});
  }
  render() {
    let isAnyFieldEmpty = this.state.name.length === 0 || this.state.code.length === 0;

    return (
      <bem.FormView__form m='add-language-fields'>
        <bem.FormView__cell m='lang-name'>
          <bem.FormModal__item>
            <label>{(this.props.isDefault) ? t('Default language name') : t('Language name')}</label>
            <TextBox
              value={this.state.name}
              onChange={this.onNameChange}
              errors={this.state.nameError}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='lang-code'>
          <bem.FormModal__item>
            <label>{(this.props.isDefault) ? t('Default language code') : t('Language code')}</label>
            <TextBox
              value={this.state.code}
              onChange={this.onCodeChange}
              errors={this.state.codeError}
            />
          </bem.FormModal__item>
        </bem.FormView__cell>

        <bem.FormView__cell m='submit-button'>
          <bem.KoboButton
            m='blue'
            onClick={this.onSubmit} type='submit'
            disabled={isAnyFieldEmpty}
          >
            {this.props.langIndex !== undefined ? t('Update') : (this.props.isDefault) ? t('Set') : t('Add')}
          </bem.KoboButton>
        </bem.FormView__cell>
      </bem.FormView__form>
      );
  }
}

export default LanguageForm;
