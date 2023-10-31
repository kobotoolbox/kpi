import debounce from 'lodash.debounce';
import React from 'react';
import {observer} from 'mobx-react';
import bem from 'js/bem';
import searchBoxStore from './searchBoxStore';
import {KEY_CODES} from 'js/constants';
import {autorun} from 'mobx';

interface SearchBoxProps {
  /** A text to be displayed in empty input. */
  placeholder?: string;
  /** For disabling input. */
  disabled?: boolean;
}

interface SearchBoxState {
  inputVal: string;
}

class SearchBox extends React.Component<SearchBoxProps, SearchBoxState> {
  setSearchPhraseDebounced = debounce(this.setSearchPhrase.bind(this), 500);
  cancelAutorun?: () => void;

  constructor(props: SearchBoxProps) {
    super(props);
    this.state = {
      inputVal: searchBoxStore.data.searchPhrase || '',
    };
  }

  componentDidMount() {
    // We use autorun here instead of simply using `observer`, because we can't
    // use `searchPhrase` directly inside the input.
    this.cancelAutorun = autorun(() => {
      this.searchBoxStoreChanged();
    });
  }

  componentWillUnmount() {
    if (typeof this.cancelAutorun === 'function') {
      this.cancelAutorun();
    }
  }

  searchBoxStoreChanged() {
    this.setState({inputVal: searchBoxStore.data.searchPhrase || ''});
  }

  onInputChange(evt: React.ChangeEvent<HTMLInputElement>) {
    const newVal = evt.target.value;
    // set `inputVal` immediately, but update store after some time
    // to avoid unnecessary updates while typing
    this.setState({inputVal: newVal});
    this.setSearchPhraseDebounced(newVal);
  }

  onInputKeyUp(evt: React.KeyboardEvent<HTMLInputElement>) {
    if (evt.keyCode === KEY_CODES.ENTER) {
      this.setSearchPhrase(this.state.inputVal);
    }
  }

  setSearchPhrase(searchPhrase: string) {
    searchBoxStore.setSearchPhrase(searchPhrase);
  }

  clear() {
    searchBoxStore.setSearchPhrase('');
  }

  render() {
    return (
      <bem.Search>
        <bem.Search__icon className='k-icon k-icon-search' />
        <bem.SearchInput
          type='text'
          value={this.state.inputVal}
          onChange={this.onInputChange.bind(this)}
          onKeyUp={this.onInputKeyUp.bind(this)}
          placeholder={this.props.placeholder || t('Search…')}
          disabled={this.props.disabled}
        />
        {this.state.inputVal !== '' && (
          <bem.Search__cancel
            className='k-icon k-icon-close'
            onClick={this.clear}
          />
        )}
      </bem.Search>
    );
  }
}

export default observer(SearchBox);
