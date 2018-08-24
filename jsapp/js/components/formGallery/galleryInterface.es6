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
export const GRID_PAGE_LIMIT = PAGE_SIZE * 2;

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
  'loadMoreGalleryMedias'
]);

galleryActions.openSingleModal.listen(({galleryIndex, mediaIndex}) => {
  galleryActions.selectGalleryMedia({galleryIndex, mediaIndex});
  stores.pageState.showModal({type: MODAL_TYPES.GALLERY_SINGLE});
});

galleryActions.openPaginatedModal.listen(({galleryIndex}) => {
  galleryActions.selectGalleryMedia({galleryIndex});
  stores.pageState.showModal({type: MODAL_TYPES.GALLERY_PAGINATED});
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
      nextGalleriesPageUrl: null,
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
    this.setState({formUid: uid});
    this.wipeAndLoadData();
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
    if (this.state.nextGalleriesPageUrl) {
      this.loadNextGalleriesPage();
    } else {
      throw new Error('No more galleries to load!');
    }
  }

  onLoadMoreGalleryMedias(galleryIndex, pageToLoad=null, pageSize=PAGE_SIZE, sort='asc') {
    const targetGallery = this.state.galleries[galleryIndex];
    if (pageToLoad === null) {
      pageToLoad = targetGallery.guessNextPageToLoad()
    }
    if (pageToLoad !== null) {
      this.loadNextGalleryMediasPage(galleryIndex, pageToLoad, pageSize, sort);
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
          galleries: this.buildGalleries(response.results),
          totalMediaCount: response.attachments_count,
          nextGalleriesPageUrl: response.next,
          isLoadingGalleries: false
        });
      });
  }

  loadNextGalleriesPage() {
    this.setState({isLoadingGalleries: true});
    dataInterface.loadNextPageUrl(this.state.nextGalleriesPageUrl)
      .done((response) => {
        this.state.galleries = this.state.galleries.concat(this.buildGalleries(response.results));
        this.trigger({galleries: this.state.galleries});
        this.setState({
          totalMediaCount: response.attachments_count,
          nextGalleriesPageUrl: response.next,
          isLoadingGalleries: false
        });
      });
  }

  loadNextGalleryMediasPage(galleryIndex, pageToLoad, pageSize, sort) {
    const targetGallery = this.state.galleries[galleryIndex];
    targetGallery.setIsLoadingMedias(true);
    this.trigger({galleries: this.state.galleries});

    dataInterface.loadMoreAttachments(
      this.state.formUid,
      this.state.filterGroupBy.value,
      galleryIndex,
      pageToLoad,
      pageSize,
      sort
    )
      .done((response) => {
        const targetGallery = this.state.galleries[galleryIndex];
        targetGallery.addMedias(response.attachments.results, pageToLoad - 1, pageSize);
        targetGallery.setIsLoadingMedias(false);
        this.trigger({galleries: this.state.galleries});
      });
  }

  buildGalleries(results) {
    const galleries = [];
    results.forEach((result) => {
      galleries[result.index] = new Gallery(result);
    });
    return galleries;
  }
}

class Gallery {
  constructor(galleryData) {
    this.galleryIndex = galleryData.index;
    this.isLoadingMedias = false;
    this.medias = [];
    this.loadedMediaCount = 0;
    this.totalMediaCount = galleryData.attachments.count;
    this.title = this.buildGalleryTitle(galleryData);
    this.dateCreated = this.buildGalleryDate(galleryData);

    this.addMedias(galleryData.attachments.results);
  }

  setIsLoadingMedias(isLoadingMedias) {
    this.isLoadingMedias = isLoadingMedias;
  }

  guessNextPageToLoad() {
    if (this.totalMediaCount === this.loadedMediaCount) {
      return null;
    } else {
      const currentPage = this.loadedMediaCount / PAGE_SIZE;
      return currentPage + 1;
    }
  }

  buildGalleryTitle(galleryData) {
    if (galleryStore.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
      return galleryData.label || t('Unknown question');
    } else {
      return t('Record ##number##').replace('##number##', parseInt(this.galleryIndex) + 1);
    }
  }

  buildGalleryDate(galleryData) {
    if (galleryData.date_created) {
      return formatTimeDate(galleryData.date_created);
    } else if (galleryData.attachments.results[0] && galleryData.attachments.results[0].submission) {
      return formatTimeDate(galleryData.attachments.results[0].submission.date_created);
    } else {
      console.error('Unknown gallery date created');
    }
  }

  addMedias(medias, pageOffset=0, pageSize=PAGE_SIZE) {
    medias.forEach((mediaData, index) => {
      // TODO this is possibly wrong information, would be best if backend
      // would provide real index
      const mediaIndex = index + pageOffset * pageSize;
      this.medias[mediaIndex] = {
        mediaIndex: mediaIndex,
        mediaId: mediaData.id,
        title: this.buildMediaTitle(mediaData, mediaIndex),
        date: this.buildMediaDate(mediaData),
        filename: mediaData.short_filename,
        smallImage: mediaData.small_download_url,
        mediumImage: mediaData.medium_download_url,
        largeImage: mediaData.large_download_url,
        canViewSubmission: mediaData.can_view_submission
      }
    });
    this.loadedMediaCount += medias.length;
  }

  buildMediaDate(mediaData) {
    if (galleryStore.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
      return this.dateCreated;
    } else if (mediaData.submission && mediaData.submission.date_created) {
      return formatTimeDate(mediaData.submission.date_created);
    } else {
      console.error('Unknown media date created', mediaData);
    }
  }

  buildMediaTitle(mediaData, mediaIndex) {
    if (galleryStore.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
      return t('Record ##number##').replace('##number##', parseInt(mediaIndex) + 1);
    } else if (mediaData.question && mediaData.question.label) {
      return mediaData.question.label;
    } else if (this.title) {
      return this.title;
    } else {
      console.error('Unknown media title', mediaData);
    }
  }
}

export const galleryStore = Reflux.initStore(GalleryStore);
