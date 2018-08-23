import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import stores from '../../stores';
import {
  PAGE_SIZE,
  GROUPBY_OPTIONS,
  galleryActions,
  galleryStore
} from './galleryInterface';
import { dataInterface } from '../../dataInterface';
import FormGalleryGridItem from './formGalleryGridItem';
import {
  t,
  formatTimeDate
} from '../../utils';
import ReactPaginate from 'react-paginate';
import Select from 'react-select';

const OFFSET_OPTIONS = [
  {value: PAGE_SIZE * 2, label: '12'},
  {value: PAGE_SIZE * 4, label: '24'},
  {value: PAGE_SIZE * 8, label: '48'},
  {value: PAGE_SIZE * 16, label: '96'}
];
const SORT_OPTIONS = [
  {label: t('Show oldest first'), value: 'asc'},
  {label: t('Show latest first'), value: 'desc'}
];

export default class PaginatedGalleryModal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      offsetValue: OFFSET_OPTIONS[0].value,
      sortValue: SORT_OPTIONS[0].value,
      currentPage: 1,
      gallery: galleryStore.state.galleries[galleryStore.state.selectedGalleryIndex],
      filterGroupBy: galleryStore.state.filterGroupBy
    };
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.galleries) {
        this.setState({gallery: storeChanges.galleries[galleryStore.state.selectedGalleryIndex]});
      }
      if (storeChanges.filterGroupBy) {
        this.setState({filterGroupBy: storeChanges.filterGroupBy});
      }
    });
  }

  getTotalPages() {
    return Math.ceil(this.state.gallery.totalMediaCount / this.state.offsetValue);
  }

  setCurrentPage(index) {
    this.setState({ currentPage: index });
  }

  changeOffset(offsetValue) {
    this.setState({ offsetValue: offsetValue }, function() {
      this.goToPage(this.state.currentPage);
    });
  }

  changeSort(sort) {
    this.setState({ sortValue: sort }, function() {
      console.error('TODO work this out!')
      this.goToPage(this.state.currentPage);
    });
  }

  goToPage(newPage) {
    if (this.state.gallery.loadedMediaCount < (newPage + 1) * this.state.offsetValue) {
      galleryActions.loadMoreGalleryMedias(
        this.state.gallery.galleryIndex,
        newPage,
        this.state.offsetValue,
        this.state.sortValue
      );
    }
    this.setCurrentPage(newPage);
  }

  getCurrentPageMedia() {
    const min = this.state.offsetValue * (this.state.currentPage - 1);
    const max = this.state.offsetValue * this.state.currentPage;
    return this.state.gallery.medias.filter((media) => {
      return (media.mediaIndex >= min && media.mediaIndex < max);
    });
  }

  renderLoadingMessage() {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {t('Loading…')}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }

  renderGallery() {
    const currentPageMedia = this.getCurrentPageMedia();

    if (this.state.gallery.isLoading || currentPageMedia.length === 0) {
      return (
        <bem.PaginatedGalleryModal_galleryWrapper>
          {this.renderLoadingMessage()}
        </bem.PaginatedGalleryModal_galleryWrapper>
      );
    } else {
      return (
        <bem.PaginatedGalleryModal_galleryWrapper>
          <bem.AssetGalleryGrid m='6-per-row'>
            { currentPageMedia.map(
              (media, index) => {
                return (
                  <FormGalleryGridItem
                    key={index}
                    url={media.smallImage}
                    galleryIndex={this.state.gallery.galleryIndex}
                    mediaIndex={media.mediaIndex}
                    mediaTitle={media.title}
                    date={media.date}
                  />
                );
              }
            )}
          </bem.AssetGalleryGrid>
        </bem.PaginatedGalleryModal_galleryWrapper>
      );
    }
  }

  render() {
    return (
      <bem.PaginatedGalleryModal>
        <bem.PaginatedGalleryModal_heading>
          <h2>{t('All photos of ##name##').replace('##name##', this.state.gallery.title)}</h2>
          <h4>{t('Showing ##count## of ##total##').replace('##count##', this.state.offsetValue).replace('##total##', this.state.gallery.totalMediaCount)}</h4>
        </bem.PaginatedGalleryModal_heading>

        <bem.PaginatedGalleryModal_body>
          <GalleryControls
            offsetValue={this.state.offsetValue}
            changeOffset={this.changeOffset}
            pageCount={this.getTotalPages()}
            goToPage={this.goToPage}
            currentPage={this.state.currentPage}
            sortValue={this.state.sortValue}
            changeSort={this.changeSort}
          />

          {this.renderGallery()}

          <GalleryControls
            offsetValue={this.state.offsetValue}
            changeOffset={this.changeOffset}
            pageCount={this.getTotalPages()}
            goToPage={this.goToPage}
            currentPage={this.state.currentPage}
            sortValue={this.state.sortValue}
            changeSort={this.changeSort}
            selectDirectionUp
          />

        </bem.PaginatedGalleryModal_body>
      </bem.PaginatedGalleryModal>
    );
  }
};

class GalleryControls extends React.Component {
  onPaginatePageChange(evt) {
    this.props.goToPage(evt.selected + 1);
  }

  render() {
    const controlsMod = this.props.selectDirectionUp ? 'select-direction-up' : '';
    return (
      <bem.PaginatedGalleryModal_controls m={controlsMod}>
        <div className='change-offset'>
          <label>{t('Per page:')}</label>

          <Select
            className='Select--underlined'
            options={OFFSET_OPTIONS}
            simpleValue
            name='selected-filter'
            value={this.props.offsetValue}
            onChange={this.props.changeOffset}
            autoBlur
            searchable={false}
            clearable={false}
          />
        </div>

        <ReactPaginate
          previousLabel={t('Previous')}
          nextLabel={t('Next')}
          breakLabel={'…'}
          breakClassName={'break-me'}
          pageCount={this.props.pageCount}
          marginPagesDisplayed={1}
          pageRangeDisplayed={3}
          onPageChange={this.onPaginatePageChange.bind(this)}
          containerClassName={'pagination'}
          activeClassName={'active'}
          forcePage={this.props.currentPage - 1}
        />

        <Select
          className='Select--underlined change-sort'
          options={SORT_OPTIONS}
          simpleValue
          name='selected-filter'
          value={this.props.sortValue}
          onChange={this.props.changeSort}
          autoBlur
          searchable={false}
          clearable={false}
        />
      </bem.PaginatedGalleryModal_controls>
    );
  }
};

reactMixin(PaginatedGalleryModal.prototype, Reflux.ListenerMixin);
