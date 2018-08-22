import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import { dataInterface } from '../../dataInterface';
import stores from '../../stores';
import {galleryActions, galleryStore} from './galleryInterface';
import FormGalleryFilter from './formGalleryFilter';
import FormGalleryGrid from './formGalleryGrid';
import {
  t,
  assign,
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
    if (this.hasAnyMediaQuestions()) {
      galleryActions.setFormUid(this.props.uid);
      this.listenTo(galleryStore, (storeChanges) => {
        this.setState(storeChanges);
      });
    }
  }

  getInitialState() {
    const stateObj = {}
    assign(stateObj, galleryStore.state);
    stateObj.nextRecordsPage = 2;
    return stateObj;
  }

  hasAnyMediaQuestions() {
    return this.props.mediaQuestions.length !== 0;
  }

  // Pagination
  loadMoreAttachments(galleryIndex, galleryPage) {
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
    galleryActions.loadNextRecordsPage();
  }

  getGalleryTitleFromData(galleryData, galleryIndex) {
    if (this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.question.value) {
      return galleryData.label || t('Unknown question');
    } else {
      return t('Record ##number##').replace('##number##', parseInt(galleryIndex) + 1);
    }
  }

  isGalleryMatchingSearchQuery(galleryData) {
    if (this.state.filterQuery === '') {
      return true;
    } else {
      const searchRegEx = new RegExp(this.state.filterQuery, 'i');
      return (
        searchRegEx.test(galleryData.label) ||
        searchRegEx.test(formatTimeDate(galleryData.date_created))
      );
    }
  }

  render() {
    // CASE: form with no media questions
    if (!this.hasAnyMediaQuestions()) {
      return (
        <bem.AssetGallery>
          <bem.Loading>
            <bem.Loading__inner>
              {t('This form does not have any media questions.')}
            </bem.Loading__inner>
          </bem.Loading>
        </bem.AssetGallery>
      )
    }

    // CASE: loading data from the start
    else if (this.state.isLoadingGalleries && this.state.galleries.length === 0) {
      return (
        <bem.AssetGallery>
          <bem.Loading>
            <bem.Loading__inner>
              <i />
              {t('loading...')}
            </bem.Loading__inner>
          </bem.Loading>
        </bem.AssetGallery>
        )
    }

    // CASE: some data already loaded and possibly loading more
    else {
      return (
        <bem.AssetGallery>
          <FormGalleryFilter/>

          {this.state.galleries.map(
            (record, i) => {
              if (this.isGalleryMatchingSearchQuery(record)) {
                return (
                  <FormGalleryGrid
                    key={i}
                    uid={this.props.uid}
                    galleryTitle={this.getGalleryTitleFromData(record, i)}
                    galleryIndex={i}
                    galleryItems={record.attachments.results}
                    gallery={record}
                    totalAttachmentsCount={record.attachments.count}
                    loadMoreAttachments={this.loadMoreAttachments}
                    defaultPageSize={DEFAULT_PAGE_SIZE}
                  />
                );
              } else {
                return null;
              }
            }
          )}

          { this.state.nextPageUrl &&
            this.state.filterQuery === '' &&
            <bem.AssetGallery__loadMore>
              {this.state.isLoadingGalleries &&
                <bem.AssetGallery__loadMoreMessage>
                  {t('Loading…')}
                </bem.AssetGallery__loadMoreMessage>
              }
              {!this.state.isLoadingGalleries &&
                <bem.AssetGallery__loadMoreButton onClick={this.loadMoreRecords}>
                  {t('Load more results')}
                </bem.AssetGallery__loadMoreButton>
              }
            </bem.AssetGallery__loadMore>
          }
        </bem.AssetGallery>
      );
    }
  }
};

reactMixin(FormGallery.prototype, Reflux.ListenerMixin);
