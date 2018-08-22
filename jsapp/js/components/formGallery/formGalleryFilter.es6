import _ from 'underscore';
import React from 'react';
import Select from 'react-select';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import TextBox from '../textBox';
import bem from '../../bem';
import ui from '../../ui';
import stores from '../../stores';
import {
  GROUPBY_OPTIONS,
  galleryActions,
  galleryStore
} from './galleryInterface';
import { t } from '../../utils';

const groupByOptions = [
  GROUPBY_OPTIONS.question,
  GROUPBY_OPTIONS.submission
];

export default class FormGalleryFilter extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      totalMediaCount: galleryStore.state.totalMediaCount,
      filterQuery: galleryStore.state.filterQuery,
      filterGroupBy: galleryStore.state.filterGroupBy
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      this.setState(storeChanges);
    });
  }

  onFilterQueryChange(newVal) {
    galleryActions.setFilters({filterQuery: newVal});
  }

  onFilterGroupChange(newVal) {
    galleryActions.setFilters({filterGroupBy: GROUPBY_OPTIONS[newVal]});
  }

  render() {
    return (
      <bem.AssetGallery__heading>
        <bem.AssetGallery__count>
          {this.state.totalMediaCount} {t('images')}
        </bem.AssetGallery__count>

        <bem.AssetGallery__headingSearchFilter className='section'>
          <TextBox
            type='search'
            placeholder={t('Filter results')}
            onChange={this.onFilterQueryChange}
            value={this.state.filterQuery}
          />

          <Select
            ref='filterSelect'
            options={groupByOptions}
            simpleValue
            name='selected-filter'
            className='Select--underlined'
            value={this.state.filterGroupBy ? this.state.filterGroupBy.value : false}
            onChange={this.onFilterGroupChange}
            autoBlur
            clearable={false}
            searchable={false}
          />
        </bem.AssetGallery__headingSearchFilter>
      </bem.AssetGallery__heading>
    );
  }
};

reactMixin(FormGalleryFilter.prototype, Reflux.ListenerMixin);
