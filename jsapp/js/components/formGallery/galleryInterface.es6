/*
this handles storing and managing gallery data
*/

import Reflux from 'reflux';
import stores from 'js/stores';
import {dataInterface} from 'js/dataInterface';
import {
  t,
  assign,
  stateChanges,
  formatTimeDate
} from 'js/utils';
import {MODAL_TYPES} from 'js/constants';

export const PAGE_SIZE = 6;

export const GROUPBY_OPTIONS = {
  question: {
    value: 'question',
    label: t('Group by question')
  },
  submission: {
    value: 'submission',
    label: t('Group by record')
  }
}

export const galleryActions = Reflux.createActions([
  'setFormUid',
  'openSingleModal',
  'openPaginatedModal',
  'selectGalleryMedia',
  'setFilters',
  'loadMoreGalleries',
  'loadMoreGalleryMedias',
  'getGalleryTitle',
  'getGalleryDate'
]);

galleryActions.openSingleModal.listen(({galleryIndex, mediaIndex}) => {
  galleryActions.selectGalleryMedia({galleryIndex, mediaIndex});
  stores.pageState.showModal({type: MODAL_TYPES.GALLERY_SINGLE});
});

galleryActions.openPaginatedModal.listen(({galleryIndex}) => {
  galleryActions.selectGalleryMedia({galleryIndex});
  stores.pageState.showModal({type: MODAL_TYPES.GALLERY_PAGINATED});
});

galleryActions.getGalleryTitle.trigger = (galleryIndex) => {
  if (galleryStore.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
    return galleryStore.state.galleries[galleryIndex].label || t('Unknown question');
  } else {
    return t('Record ##number##').replace('##number##', parseInt(galleryIndex) + 1);
  }
};

galleryActions.getGalleryDate.trigger = (galleryIndex) => {
  const gallery = galleryStore.state.galleries[galleryIndex];
  if (gallery.date_created) {
    return formatTimeDate(gallery.date_created);
  } else if (gallery.attachments.results[0] && gallery.attachments.results[0].submission) {
    return formatTimeDate(gallery.attachments.results[0].submission.date_created);
  } else {
    console.error('Unknown gallery date!');
  }
};

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
      // new properties
      formUid: null,
      filterQuery: '',
      filterGroupBy: GROUPBY_OPTIONS.question,
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

  /*
  managing actions
  */

  onSetFormUid(uid) {
    if (this.state.formUid !== uid) {
      this.setState({formUid: uid});
      this.wipeAndLoadData();
    }
  }

  onSelectGalleryMedia({galleryIndex, mediaIndex}) {
    const updateObj = {};
    if (typeof galleryIndex !== 'undefined') {
      updateObj.selectedGalleryIndex = parseInt(galleryIndex);
    }
    if (typeof mediaIndex !== 'undefined') {
      updateObj.selectedMediaIndex = parseInt(mediaIndex);
    }
    if (
      typeof updateObj.selectedGalleryIndex !== 'undefined' &&
      typeof updateObj.selectedMediaIndex === 'undefined'
    ) {
      // selected gallery, but not media, so we need to clear store value
      updateObj.selectedMediaIndex = null;
    }
    this.setState(updateObj);
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
    dataInterface.filterGalleryImages(this.state.formUid, this.state.filterGroupBy.value, PAGE_SIZE)
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
