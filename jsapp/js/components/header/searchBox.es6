import _ from 'underscore';
import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {searchBoxStore} from './searchBoxStore';
import {KEY_CODES} from 'js/constants';

/**
 * @prop {string} placeholder - A text to be displayed in empty input.
 * @prop {boolean} disabled - For disabling input.
 */
export default class SearchBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      inputVal: searchBoxStore.getSearchPhrase()
    };
    this.setSearchPhraseDebounced = _.debounce(this.setSearchPhrase, 500);
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(searchBoxStore, this.searchBoxStoreChanged);
  }

  searchBoxStoreChanged(store) {
    this.setState({inputVal: store.searchPhrase});
  }

  onInputChange(evt) {
    const newVal = evt.target.value;
    // set `inpuVal` immediately, but update store after some time
    // to avoid unnecessary updates while typing
    this.setState({inputVal: newVal});
    this.setSearchPhraseDebounced(newVal);
  }

  onInputKeyUp(evt) {
    if (evt.keyCode === KEY_CODES.ENTER) {
      this.setSearchPhrase(evt.target.value.trim());
    }
  }

  setSearchPhrase(searchPhrase) {
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
          onChange={this.onInputChange}
          onKeyUp={this.onInputKeyUp}
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

reactMixin(SearchBox.prototype, Reflux.ListenerMixin);
