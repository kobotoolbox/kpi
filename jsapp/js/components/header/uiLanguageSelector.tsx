import React from 'react';
import {observer} from 'mobx-react';
import bem, {makeBem} from 'js/bem';
import profileStore from 'js/components/account/profileStore';

bem.UiLanguageSelector = makeBem(null, 'ui-language-selector');

interface UiLanguageSelectorState {
  isOpen: boolean;
}

class UiLanguageSelector extends React.Component<{}, UiLanguageSelectorState> {
  private store = profileStore;

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
    this.store.setUiLanguage(langCode);
  }

  render() {
    return (
      <bem.UiLanguageSelector>
        hello
      </bem.UiLanguageSelector>
    );
  }
}

export default observer(UiLanguageSelector);
