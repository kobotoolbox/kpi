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
import {galleryActions, galleryStore} from './galleryInterface';
import { t } from '../../utils';
import { GALLERY_FILTER_OPTIONS } from '../../constants';

const groupByOptions = [
  GALLERY_FILTER_OPTIONS.question,
  GALLERY_FILTER_OPTIONS.submission
];

export default class FormGalleryFilter extends React.Component {
  constructor(props){
    super(props);
    this.state = {
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
    galleryActions.setFilters({filterGroupBy: GALLERY_FILTER_OPTIONS[newVal]});
  }

  render() {
    return (
      <bem.AssetGallery__heading>
        <bem.AssetGallery__count>
          {this.props.attachments_count} {t('images')}
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
