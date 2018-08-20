import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import FormGalleryFilter from './formGalleryFilter';
import FormGalleryGrid from './formGalleryGrid';
import { dataInterface } from '../../dataInterface';
import stores from '../../stores';
import {
  t,
  formatTimeDate
} from '../../utils';
import {
  MODAL_TYPES,
  GALLERY_FILTER_OPTIONS
} from '../../constants';

const DEFAULT_PAGE_SIZE = 6;

export default class FormGallery extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.getInitialState();
    autoBind(this);
  }

  componentDidMount() {
    if (this.props.mediaQuestions.length) {
      this.loadGalleryData(this.props.uid);
    }
    this.listenTo(stores.currentGallery, (storeChanges) => {
      this.setState(storeChanges);
      if (storeChanges.filterGroupBy) {
        this.handleFilterGroupByChange(storeChanges.filterGroupBy);
      }
    });
  }

  getInitialState() {
    return {
      hasMoreRecords: false,
      nextRecordsPage: 2,
      activeTitle: null,
      activeDate: null,
      filterQuery: stores.currentGallery.state.filterQuery,
      filterGroupBy: stores.currentGallery.state.filterGroupBy,
      galleryData: {
        count: 0,
        loaded: false,
        results: [
          {
            attachments: []
          }
        ]
      },
      galleryIndex: 0,
      galleryItemIndex: 0
    };
  }

  loadGalleryData(uid) {
    dataInterface
      .filterGalleryImages(uid, this.state.filterGroupBy.value, DEFAULT_PAGE_SIZE)
      .done(response => {
        response.loaded = true;
        this.setState({
          galleryData: response
        });
      });
  }

  handleFilterGroupByChange(newFilter) {
    this.state.galleryData.loaded = false;
    dataInterface
      .filterGalleryImages(
        this.props.uid,
        newFilter.value,
        DEFAULT_PAGE_SIZE
      )
      .done((response) => {
        response.loaded = true;
        this.setState(this.getInitialState());
        this.forceUpdate();

        this.setState({
          galleryData: response,
          hasMoreRecords: this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.submission.value
            ? response.next
            : this.state.hasMoreRecords //Check if more records exist!
        });
      });
  }

  // Pagination
  loadMoreAttachments(galleryIndex, galleryPage) {
    this.state.galleryData.loaded = false;
    dataInterface.loadQuestionAttachment(
        this.props.uid,
        this.state.filterGroupBy.value,
        galleryIndex,
        galleryPage,
        DEFAULT_PAGE_SIZE
      )
      .done(response => {
        let galleryData = this.state.galleryData;
        galleryData.results[galleryIndex].attachments.results.push(
          ...response.attachments.results
        );
        galleryData.loaded = true;
        this.setState({ galleryData });
      });
  }

  loadMoreRecords() {
    this.state.galleryData.loaded = false;
    return dataInterface.loadMoreRecords(
        this.props.uid,
        this.state.filterGroupBy.value,
        this.state.nextRecordsPage,
        DEFAULT_PAGE_SIZE
      )
      .done(response => {
        let galleryData = this.state.galleryData;
        galleryData.loaded = true;
        galleryData.results.push(...response.results);
        this.setState({
          galleryData,
          hasMoreRecords: response.next,
          nextRecordsPage: this.state.nextRecordsPage + 1
        });
      });
  }

  openModal(gallery, galleryItemIndex) {
    const galleryTitle =
      gallery.label ||
      gallery.attachments.results[galleryItemIndex].question.label;
    const galleryDate = formatTimeDate(
      gallery.date_created ||
      gallery.attachments.results[galleryItemIndex].submission.date_created
    );
    const modalFriendlyAttachments = gallery.attachments ? gallery.attachments.results : gallery;

    this.setState({
      galleryItemIndex: galleryItemIndex,
      galleryTitle: galleryTitle,
      galleryDate: galleryDate
    });

    stores.pageState.showModal({
      type: MODAL_TYPES.GALLERY_SINGLE,
      activeGallery: gallery,
      changeActiveGalleryIndex: this.changeActiveGalleryIndex,
      updateActiveAsset: this.updateActiveAsset,
      filter: this.state.filterGroupBy.value,
      galleryItemIndex: galleryItemIndex,
      galleryTitle: galleryTitle,
      galleryDate: galleryDate,
      activeGalleryAttachments: modalFriendlyAttachments
    });
  }

  changeActiveGalleryIndex(newIndex) {
    this.setState({
      galleryItemIndex: newIndex
    });
  }

  render() {
    if (!this.state.galleryData.loaded) {
      return (
        <bem.AssetGallery>
          <bem.Loading>
            {this.props.mediaQuestions.length === 0 ?
              <bem.Loading__inner>
                {t('This form does not have any media questions.')}
              </bem.Loading__inner>
            :
              <bem.Loading__inner>
                <i />
                {t('loading...')}
              </bem.Loading__inner>
            }
          </bem.Loading>
        </bem.AssetGallery>
        )
    }

    if (this.state.galleryData.loaded && this.props.mediaQuestions.length) {
      return (
        <bem.AssetGallery>
          <FormGalleryFilter
            attachments_count={this.state.galleryData.attachments_count}
          />

          {this.state.galleryData.results.map(
            function(record, i) {
              let galleryTitle;
              if (
                this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.question.value &&
                record.label
              ) {
                galleryTitle = record.label;
              } else {
                galleryTitle = t('Record') + ' ' + parseInt(i + 1);
              }

              let searchRegEx = new RegExp(this.state.filterQuery, 'i');
              let searchTermMatched =
                this.state.filterQuery == '' ||
                galleryTitle.match(searchRegEx) ||
                formatTimeDate(record.date_created).match(
                  this.state.filterQuery
                );
              if (searchTermMatched) {
                return (
                  <FormGalleryGrid
                    key={i}
                    uid={this.props.uid}
                    galleryTitle={galleryTitle}
                    galleryIndex={i}
                    galleryItems={record.attachments.results}
                    gallery={record}
                    totalAttachmentsCount={record.attachments.count}
                    loadMoreAttachments={this.loadMoreAttachments}
                    openModal={this.openModal}
                    defaultPageSize={DEFAULT_PAGE_SIZE}
                  />
                );
              } else {
                return null;
              }
            }.bind(this)
          )}

          { this.state.hasMoreRecords &&
            this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.question.value &&
            this.state.filterQuery === '' &&
            <bem.AssetGallery__gridLoadMore>
              <button
                onClick={this.loadMoreRecords}
                className='mdl-button mdl-button--colored'
              >
                {t('Load more')}
              </button>
            </bem.AssetGallery__gridLoadMore>
          }
        </bem.AssetGallery>
      );
    }
  }
};

reactMixin(FormGallery.prototype, Reflux.ListenerMixin);
