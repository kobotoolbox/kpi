/*
this handles storing and managing gallery data
*/

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

export const DEFAULT_PAGE_SIZE = 6;

export const galleryActions = Reflux.createActions([
  'setFormUid',
  'openSingleModal',
  'setActiveGalleryIndex',
  'setFilters',
  'loadMoreGalleries',
  'loadMoreGalleryMedias'
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

  /*
  managing state
  */

  getInitialState() {
    const stateObj = {}
    assign(stateObj, {
      activeGallery: null,
      activeGalleryIndex: null,
      activeGalleryAttachments: null,
      activeGalleryTitle: null,
      activeGalleryDate: null,
      // new properties
      formUid: null,
      filterQuery: '',
      filterGroupBy: GALLERY_FILTER_OPTIONS.question,
      isLoadingGalleries: false,
    });
    assign(stateObj, this.getWipedGalleriesState());
    return stateObj;
  }

  getWipedGalleriesState() {
    return {
      galleries: [],
      areLoadingMedias: {},
      nextPageUrl: null,
      totalMediaCount: null,
      selectedGalleryIndex: null,
      selectedMediaIndex: null
    }
  }

  setState(newState) {
    let changes = stateChanges(this.state, newState);
    if (changes) {
      assign(this.state, newState);
      this.trigger(changes);
    }
  }

  onSetFormUid(uid) {
    if (this.state.formUid !== uid) {
      this.setState({formUid: uid});
      this.wipeAndLoadData();
    }
  }

  /*
  managing actions
  */

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
    this.setState({activeGalleryIndex: parseInt(galleryIndex)});
  }

  onSetFilters(filters) {
    let needsWipeAndLoad = false;

    const updateObj = {};
    if (typeof filters.filterQuery !== 'undefined') {
      updateObj.filterQuery = filters.filterQuery;
    }
    if (typeof filters.filterGroupBy !== 'undefined') {
      updateObj.filterGroupBy = filters.filterGroupBy;
      if (updateObj.filterGroupBy.value !== this.state.filterGroupBy.value) {
        needsWipeAndLoad = true;
      }
    }
    this.setState(updateObj);

    if (needsWipeAndLoad) {
      this.wipeAndLoadData();
    }
  }

  onLoadMoreGalleries() {
    if (this.state.nextPageUrl) {
      this.loadNextGalleriesPage();
    } else {
      throw new Error('No more galleries to load!');
    }
  }

  onLoadMoreGalleryMedias(galleryIndex) {
    const targetGallery = this.state.galleries[galleryIndex];
    const nextPageUrl = targetGallery.attachments.next;
    if (nextPageUrl) {
      this.loadNextGalleryMediasPage(galleryIndex, nextPageUrl);
    } else {
      throw new Error('No more gallery medias to load!');
    }
  }

  /*
  fetching data from endpoint
  */

  wipeAndLoadData() {
    this.setState(this.getWipedGalleriesState());
    this.setState({isLoadingGalleries: true});
    dataInterface.filterGalleryImages(this.state.formUid, this.state.filterGroupBy.value, DEFAULT_PAGE_SIZE)
      .done((response) => {
        this.setState({
          galleries: response.results,
          totalMediaCount: response.attachments_count,
          nextPageUrl: response.next,
          isLoadingGalleries: false
        });
      });
  }

  loadNextGalleriesPage() {
    this.setState({isLoadingGalleries: true});
    dataInterface.loadNextPageUrl(this.state.nextPageUrl)
      .done((response) => {
        this.state.galleries.push(...response.results)
        this.setState({
          totalMediaCount: response.attachments_count,
          nextPageUrl: response.next,
          isLoadingGalleries: false
        });
      });
  }

  loadNextGalleryMediasPage(galleryIndex, nextPageUrl) {
    this.setIsLoadingMedias(galleryIndex, true);
    dataInterface.loadNextPageUrl(nextPageUrl)
      .done((response) => {
        const currentGalleries = [];
        assign(currentGalleries, this.state.galleries);
        const targetGallery = currentGalleries[galleryIndex];
        targetGallery.attachments.count = response.attachments.count;
        targetGallery.attachments.next = response.attachments.next;
        targetGallery.attachments.next_page = response.attachments.next_page;
        targetGallery.attachments.previous = response.attachments.previous;
        targetGallery.attachments.previous_page = response.attachments.previous_page;
        targetGallery.attachments.results.push(...response.attachments.results);
        currentGalleries[galleryIndex] = targetGallery;
        this.setState({galleries: currentGalleries});
        this.setIsLoadingMedias(galleryIndex, false);
      });
  }

  setIsLoadingMedias(galleryIndex, isLoading) {
    const currentObj = {};
    assign(currentObj, this.state.areLoadingMedias);
    currentObj[galleryIndex] = isLoading;
    this.setState({areLoadingMedias: currentObj});
  }
}

export const galleryStore = Reflux.initStore(GalleryStore);
