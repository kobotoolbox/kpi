import Reflux from 'reflux';
import stores from 'js/stores';
import {dataInterface} from 'js/dataInterface';
import {
  assign,
  stateChanges,
  formatTimeDate
} from 'js/utils';
import {
  MODAL_TYPES,
  GALLERY_FILTER_OPTIONS
} from 'js/constants';

const DEFAULT_PAGE_SIZE = 6;

export const galleryActions = Reflux.createActions([
  'loadGalleryData',
  'openSingleModal',
  'setActiveGalleryIndex',
  'setFilters'
]);

galleryActions.openSingleModal.listen((/*{gallery, galleryTitle, galleryIndex}*/) => {
  // we only need to open the modal, all data is kept and handled by galleryStore
  stores.pageState.showModal({type: MODAL_TYPES.GALLERY_SINGLE});
});

class GalleryStore extends Reflux.Store {
  constructor() {
    super();
    this.listenables = galleryActions;
    this.state = this.getInitialState();
  }

  getInitialState() {
    return {
      activeGallery: null,
      activeGalleryIndex: null,
      activeGalleryAttachments: null,
      activeGalleryTitle: null,
      activeGalleryDate: null,
      filterQuery: '',
      filterGroupBy: GALLERY_FILTER_OPTIONS.question,
      selectedGalleryIndex: null,
      selectedMediaIndex: null,
      galleries: [],
      totalMediaCount: null,
      nextPageUrl: null,
      isLoadingData: false
    };
  }

  onLoadGalleryData(uid) {
    this.setState({
      isLoadingData: true
    });
    dataInterface.filterGalleryImages(uid, this.state.filterGroupBy.value, DEFAULT_PAGE_SIZE)
      .done((response) => {
        console.log(response);
        this.setState({
          galleries: response.results,
          totalMediaCount: response.attachments_count,
          nextPageUrl: response.next,
          isLoadingData: false
        });
      });
  }

  onOpenSingleModal({gallery, galleryTitle, galleryIndex}) {
    const activeGalleryDate = formatTimeDate(gallery.date_created || gallery[galleryIndex].submission.date_created);
    const modalFriendlyAttachments = gallery.attachments ? gallery.attachments.results : gallery;

    this.setState({
      activeGallery: gallery,
      activeGalleryAttachments: modalFriendlyAttachments,
      activeGalleryIndex: parseInt(galleryIndex),
      activeGalleryTitle: galleryTitle,
      activeGalleryDate: activeGalleryDate,
    });
  }

  onSetActiveGalleryIndex(galleryIndex) {
    this.setState({
      activeGalleryIndex: parseInt(galleryIndex)
    });
  }

  onSetFilters(filters) {
    const updateObj = {};
    if (typeof filters.filterQuery !== 'undefined') {
      updateObj.filterQuery = filters.filterQuery;
    }
    if (typeof filters.filterGroupBy !== 'undefined') {
      updateObj.filterGroupBy = filters.filterGroupBy;
    }
    this.setState(updateObj);
  }

  setState(newState) {
    var changes = stateChanges(this.state, newState);
    if (changes) {
      assign(this.state, newState);
      this.trigger(changes);
    }
  }
}

export const galleryStore = Reflux.initStore(GalleryStore);
