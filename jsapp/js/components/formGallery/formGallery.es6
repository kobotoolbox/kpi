import React from 'react';
import autoBind from 'react-autobind';
import bem from '../../bem';
import FormGalleryModal from './formGalleryModal';
import FormGalleryFilter from './formGalleryFilter';
import FormGalleryGrid from './formGalleryGrid';
import { dataInterface } from '../../dataInterface';
import stores from '../../stores';
import {
  t,
  formatTimeDate
} from '../../utils';
import {MODAL_TYPES} from '../../constants';

const DEFAULT_PAGE_SIZE = 6;

export default class FormGallery extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = this.getInitialState();
  }

  getInitialState() {
    return {
      hasMoreRecords: false,
      nextRecordsPage: 2,
      activeTitle: null,
      activeDate: null,
      searchTerm: '',
      filter: {
        source: 'question',
        label: t('Group by question')
      },
      filterOptions: [
        {
          value: 'question',
          label: t('Group by question')
        },
        {
          value: 'submission',
          label: t('Group by record')
        }
      ],
      assets: {
        count: 0,
        loaded: false,
        results: [
          {
            attachments: []
          }
        ]
      },
      galleryIndex: 0,
      galleryItemIndex: 0,
      galleryTitle: '',
      galleryDate: ''
    };
  }

  componentDidMount() {
    if (this.props.mediaQuestions.length)
      this.loadGalleryData(this.props.uid, 'question');
  }

  loadGalleryData(uid, selectedFilter) {
    dataInterface
      .filterGalleryImages(uid, selectedFilter, DEFAULT_PAGE_SIZE)
      .done(response => {
        response.loaded = true;
        this.setState({
          assets: response
        });
      });
  }

  setAssets(newAssets) {
    this.setState({
      assets: newAssets
    });
  }

  onFilterGroupChange(value) {
    var label;
    var newFilter = value;
    for (var i = 0; i < this.state.filterOptions.length; i++) {
      if (this.state.filterOptions[i].value == newFilter) {
        label = this.state.filterOptions[i].label;
      }
    }

    dataInterface
      .filterGalleryImages(
        this.props.uid,
        newFilter,
        DEFAULT_PAGE_SIZE
      )
      .done((response) => {
        response.loaded = true;
        this.setState(this.getInitialState());
        this.forceUpdate();

        this.setState({
          filter: {
            source: newFilter,
            label: label
          },
          assets: response,
          hasMoreRecords: newFilter == 'submission'
            ? response.next
            : this.state.hasMoreRecords //Check if more records exist!
        });
      });
  }

  onFilterQueryChange(filter) {
    let term = filter.target ? filter.target.value : filter; //Check if an event was passed or string
    this.setState({ searchTerm: term });
  }

  // Pagination
  loadMoreAttachments(galleryIndex, galleryPage) {
    this.state.assets.loaded = false;
    dataInterface.loadQuestionAttachment(
        this.props.uid,
        this.state.filter.source,
        galleryIndex,
        galleryPage,
        DEFAULT_PAGE_SIZE
      )
      .done(response => {
        let assets = this.state.assets;
        assets.results[galleryIndex].attachments.results.push(
          ...response.attachments.results
        );
        assets.loaded = true;
        this.setState({ assets });
      });
  }

  loadMoreRecords() {
    this.state.assets.loaded = false;
    return dataInterface.loadMoreRecords(
        this.props.uid,
        this.state.filter.source,
        this.state.nextRecordsPage,
        DEFAULT_PAGE_SIZE
      )
      .done(response => {
        let assets = this.state.assets;
        assets.loaded = true;
        assets.results.push(...response.results);
        this.setState({
          assets,
          hasMoreRecords: response.next,
          nextRecordsPage: this.state.nextRecordsPage + 1
        });
      });
  }

  setActiveGalleryDateAndTitle(title, date) {
    this.setState({
      galleryTitle: title,
      galleryDate: date
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
      type: MODAL_TYPES.GALLERY,
      activeGallery: gallery,
      changeActiveGalleryIndex: this.changeActiveGalleryIndex,
      updateActiveAsset: this.updateActiveAsset,
      onFilterQueryChange: this.onFilterQueryChange,
      filter: this.state.filter.source,
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
    if (!this.state.assets.loaded) {
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

    if (this.state.assets.loaded && this.props.mediaQuestions.length) {
      return (
        <bem.AssetGallery>
          <FormGalleryFilter
            attachments_count={this.state.assets.attachments_count}
            currentFilter={this.state.filter}
            filters={this.state.filterOptions}
            onFilterGroupChange={this.onFilterGroupChange}
            onFilterQueryChange={this.onFilterQueryChange}
            searchTerm={this.state.searchTerm}
          />

          {this.state.assets.results.map(
            function(record, i) {
              let galleryTitle = this.state.filter.source === 'question'
                ? record.label
                : t('Record') + ' ' + parseInt(i + 1);
              let searchRegEx = new RegExp(this.state.searchTerm, 'i');
              let searchTermMatched =
                this.state.searchTerm == '' ||
                galleryTitle.match(searchRegEx) ||
                formatTimeDate(record.date_created).match(
                  this.state.searchTerm
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
                    galleryAttachmentsCount={record.attachments.count}
                    loadMoreAttachments={this.loadMoreAttachments}
                    currentFilter={this.state.filter.source}
                    openModal={this.openModal}
                    defaultPageSize={DEFAULT_PAGE_SIZE}
                    setAssets={this.setAssets}
                    setActiveGalleryDateAndTitle={
                      this.setActiveGalleryDateAndTitle
                    }
                  />
                );
              } else {
                return null;
              }
            }.bind(this)
          )}

          <div className='form-view__cell form-view__cell--centered loadmore-div'>
            {this.state.hasMoreRecords &&
              this.state.filter.source == 'submission' &&
              this.state.searchTerm == ''
              ? <button
                  onClick={this.loadMoreRecords}
                  className='mdl-button mdl-button--colored loadmore-button'
                >
                  Load more
                </button>
              : null}
          </div>
        </bem.AssetGallery>
      );
    }
  }
};
