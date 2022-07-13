import React from 'react';
import {observer} from 'mobx-react';
import bem, {makeBem} from 'js/bem';
import type {EnvStoreDataItem} from 'js/envStore';
import envStore from 'js/envStore';
import profileStore from 'js/components/account/profileStore';
import Icon from 'js/components/common/icon';

bem.UiLanguageSelector = makeBem(null, 'ui-language-selector');

interface UiLanguageSelectorState {
  isOpen: boolean;
}

class UiLanguageSelector extends React.Component<{}, UiLanguageSelectorState> {
  private profileStore = profileStore;

  constructor(props: {}) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  open() {
    this.setState({isOpen: true});
  }

  close() {
    this.setState({isOpen: false});
  }

  toggle() {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  onSelectLanguage(langCode: string) {
    this.profileStore.setUiLanguage(langCode);
  }

  renderLanguageItem(language: EnvStoreDataItem) {
    const currentLanguage = this.profileStore.uiLanguage;
    return (
      <bem.AccountBox__menuLI key={language.value}>
        <bem.AccountBox__menuLink
          disabled={this.profileStore.isLoading}
          onClick={this.onSelectLanguage.bind(this, language.value)}
        >
          {language.value === currentLanguage &&
            <strong>{language.label}</strong>
          }
          {language.value !== currentLanguage &&
            language.label
          }
        </bem.AccountBox__menuLink>
      </bem.AccountBox__menuLI>
    );
  }

  render() {
    let languages: EnvStoreDataItem[] = [];
    if (envStore.isReady && envStore.data.interface_languages) {
      languages = envStore.data.interface_languages;
    }

    return (
      <bem.UiLanguageSelector>
        <bem.AccountBox__menuLink
          onClick={this.toggle.bind(this)}
          data-popover-menu-stop-blur
          tabIndex='0'
        >
          <Icon name='language' size='m'/>
          {t('Language')}
        </bem.AccountBox__menuLink>

        {this.state.isOpen &&
          <ul>
            {languages.map(this.renderLanguageItem.bind(this))}
          </ul>
        }
      </bem.UiLanguageSelector>
    );
  }
}

export default observer(UiLanguageSelector);
