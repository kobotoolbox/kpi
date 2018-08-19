import React from 'react';
import bem from '../../bem';
import ui from '../../ui';
import { t } from '../../utils';
import Select from 'react-select';

export default class FormGalleryFilter extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
  }
  render() {
    return (
      <bem.AssetGallery__heading>
        <bem.AssetGallery__count>
          {this.props.attachments_count} {t('images')}
        </bem.AssetGallery__count>

        <bem.AssetGallery__headingSearchFilter className='section'>
          <input
            type='search'
            className='text-display'
            placeholder={t('Filter results')}
            onChange={this.props.onFilterQueryChange}
            value={this.props.searchTerm}
          />

          <Select
            ref='filterSelect'
            options={this.props.filters}
            simpleValue
            name='selected-filter'
            value={this.props.currentFilter.source}
            onChange={this.props.onFilterGroupChange}
            autoBlur
            clearable={false}
            searchable={false}
          />
      </bem.AssetGallery__headingSearchFilter>
      </bem.AssetGallery__heading>
    );
  }
};
