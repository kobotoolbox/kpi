import debounce from 'lodash.debounce';
import React from 'react';
import bem from 'js/bem';
import searchBoxStore from './searchBoxStore';
import type {SearchBoxStoreData} from './searchBoxStore';
import {KEY_CODES} from 'js/constants';

interface SearchBoxProps {
  /** A text to be displayed in empty input. */
  placeholder?: string;
  /** For disabling input. */
  disabled?: boolean;
}

interface SearchBoxState {
  inputVal: string;
}

export default class SearchBox extends React.Component<SearchBoxProps, SearchBoxState> {
  setSearchPhraseDebounced = debounce(this.setSearchPhrase.bind(this), 500);

  constructor(props: SearchBoxProps) {
    super(props);
    this.state = {
      inputVal: searchBoxStore.getSearchPhrase(),
    };
  }

  componentDidMount() {
    searchBoxStore.listen(this.searchBoxStoreChanged.bind(this), this);
  }

  searchBoxStoreChanged(newData: SearchBoxStoreData) {
    this.setState({inputVal: newData.searchPhrase});
  }

  onInputChange(evt: React.ChangeEvent<HTMLInputElement>) {
    const newVal = evt.target.value;
    // set `inpuVal` immediately, but update store after some time
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
    searchBoxStore.setSearchPhrase(searchPhrase.trim());
  }

  clear() {
    searchBoxStore.clear();
  }

  render() {
    return (
      <bem.Search>
        <bem.Search__icon className='k-icon k-icon-search'/>
        <bem.SearchInput
          type='text'
          value={this.state.inputVal}
          onChange={this.onInputChange.bind(this)}
          onKeyUp={this.onInputKeyUp.bind(this)}
          placeholder={this.props.placeholder || t('Search…')}
          disabled={this.props.disabled}
        />
        {this.state.inputVal !== '' &&
          <bem.Search__cancel className='k-icon k-icon-close' onClick={this.clear}/>
        }
      </bem.Search>
    );
  }
}
