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

export const PAGE_SIZE = 12;
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
export const ORDER_OPTIONS = {
  asc: {
    label: t('Show oldest first'),
    value: 'asc'
  },
  desc: {
    label: t('Show latest first'),
    value: 'desc'
  }
};

export const galleryActions = Reflux.createActions([
  'setFormUid',
  'toggleFullscreen',
  'openMediaModal',
  'selectGalleryMedia',
  'selectPreviousGalleryMedia',
  'selectNextGalleryMedia',
  'setFilters',
  'loadMoreGalleries',
  'loadMoreGalleryMedias'
]);

galleryActions.openMediaModal.listen(({galleryIndex, mediaIndex}) => {
  galleryActions.selectGalleryMedia({galleryIndex, mediaIndex});
  stores.pageState.showModal({type: MODAL_TYPES.GALLERY_MEDIA});
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
      formUid: null,
      isFullscreen: false,
      filterQuery: '',
      filterGroupBy: GROUPBY_OPTIONS.question,
      filterOrder: ORDER_OPTIONS.asc,
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
      selectedMedia: new SelectedMedia()
    }
  }

  setState(newState) {
    let changes = stateChanges(this.state, newState);
    if (changes) {
      assign(this.state, newState);
      this.trigger(changes);
    }
  }

  resetStateToInitial() {
    this.setState(this.getInitialState());
  }

  /*
  managing actions
  */

  onSetFormUid(uid) {
    this.setState({formUid: uid});
    if (uid === null) {
      this.resetStateToInitial();
    } else {
      this.wipeAndLoadData();
    }

  }

  onToggleFullscreen() {
    this.setState({isFullscreen: !this.state.isFullscreen});
  }

  onSelectGalleryMedia({galleryIndex, mediaIndex}) {
    this.setState({
      selectedMedia: new SelectedMedia(galleryIndex, mediaIndex)
    });
  }

  onSelectPreviousGalleryMedia() {
    const currentMedia = this.state.selectedMedia

    let targetGalleryIndex;
    let targetMediaIndex;

    if (currentMedia.mediaIndex !== 0) {
      targetGalleryIndex = currentMedia.galleryIndex;
      targetMediaIndex = currentMedia.mediaIndex - 1;
    }

    else if (!currentMedia.isFirst) {
      targetGalleryIndex = currentMedia.galleryIndex - 1;
      targetMediaIndex = this.state.galleries[targetGalleryIndex].totalMediaCount - 1;
    }

    galleryActions.selectGalleryMedia({
      galleryIndex: targetGalleryIndex,
      mediaIndex: targetMediaIndex
    });
  }

  onSelectNextGalleryMedia() {
    const currentMedia = this.state.selectedMedia;
    const currentMediaGallery = this.state.galleries[this.state.selectedMedia.galleryIndex];

    let targetGalleryIndex;
    let targetMediaIndex;

    if (currentMedia.mediaIndex !== currentMediaGallery.totalMediaCount - 1) {
      targetGalleryIndex = currentMedia.galleryIndex;
      targetMediaIndex = currentMedia.mediaIndex + 1;
    }

    else if (!currentMedia.isLast) {
      targetGalleryIndex = currentMedia.galleryIndex + 1;
      targetMediaIndex = 0;
    }

    galleryActions.selectGalleryMedia({
      galleryIndex: targetGalleryIndex,
      mediaIndex: targetMediaIndex
    });
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
    if (typeof filters.filterOrder !== 'undefined') {
      updateObj.filterOrder = filters.filterOrder;
      if (updateObj.filterOrder.value !== this.state.filterOrder.value) {
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

  onLoadMoreGalleryMedias(galleryIndex) {
    const targetGallery = this.state.galleries[galleryIndex];
    const pageToLoad = targetGallery.guessNextPageToLoad()

    if (pageToLoad !== null) {
      this.loadNextGalleryMediasPage(galleryIndex, pageToLoad, this.state.filterOrder.value);
    } else {
      throw new Error('No more gallery medias to load!');
    }
  }

  onMediasAdded() {
    // if selectedMedia is waiting for data reapply it
    if (this.state.selectedMedia.isLoading) {
      this.setState({
        selectedMedia: new SelectedMedia(this.state.selectedMedia.galleryIndex, this.state.selectedMedia.mediaIndex)
      })
    }
  }

  /*
  fetching data from endpoint
  */

  wipeAndLoadData() {
    this.setState(this.getWipedGalleriesState());
    this.setState({isLoadingGalleries: true});
    dataInterface.filterGalleryImages(
      this.state.formUid,
      this.state.filterGroupBy.value,
      PAGE_SIZE,
      this.state.filterOrder.value
    )
      .done((response) => {
        this.buildAndAddGalleries(response.results);
        this.setState({
          totalMediaCount: response.attachments_count,
          nextGalleriesPageUrl: response.next || null,
          isLoadingGalleries: false
        });
        this.onMediasAdded();
      });
  }

  loadNextGalleriesPage() {
    this.setState({isLoadingGalleries: true});
    dataInterface.loadNextPageUrl(this.state.nextGalleriesPageUrl)
      .done((response) => {
        this.buildAndAddGalleries(response.results);
        this.setState({
          totalMediaCount: response.attachments_count,
          nextGalleriesPageUrl: response.next || null,
          isLoadingGalleries: false
        });
        this.onMediasAdded();
      });
  }

  loadNextGalleryMediasPage(galleryIndex, pageToLoad, sort) {
    const targetGallery = this.state.galleries[galleryIndex];
    targetGallery.setIsLoadingMedias(true);
    this.trigger({galleries: this.state.galleries});

    dataInterface.loadMoreAttachments(
      this.state.formUid,
      this.state.filterGroupBy.value,
      galleryIndex,
      pageToLoad,
      PAGE_SIZE,
      sort
    )
      .done((response) => {
        const targetGallery = this.state.galleries[galleryIndex];
        targetGallery.addMedias(response.attachments.results, pageToLoad - 1);
        targetGallery.setIsLoadingMedias(false);
        this.trigger({galleries: this.state.galleries});
        this.onMediasAdded();
      });
  }

  buildAndAddGalleries(results) {
    results.forEach((result) => {
      const galleryInstance = new Gallery(result);
      this.state.galleries[galleryInstance.galleryIndex] = galleryInstance;
    });
    this.trigger({galleries: this.state.galleries});
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

  hasMoreMediasToLoad() {
    return this.loadedMediaCount < this.totalMediaCount;
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

  findMedia(mediaIndex) {
    return this.medias.find((media) => {return media.mediaIndex === mediaIndex}) || null;
  }

  addMedias(medias, pageOffset=0) {
    medias.forEach((mediaData, index) => {
      // TODO we're guessing mediaIndex here, maybe backend can provide real value
      const mediaIndex = index + (pageOffset * PAGE_SIZE);
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

class SelectedMedia {
  constructor(galleryIndex, mediaIndex) {
    this.isLoading = true;
    this.galleryIndex = null;
    this.mediaIndex = null;
    this.data = null;
    this.isFirst = false;
    this.isLast = false;
    this.isFirstInGallery = false;
    this.isLastInGallery = false;

    if (typeof galleryIndex !== 'undefined') {
      this.galleryIndex = galleryIndex;
    }

    if (typeof mediaIndex !== 'undefined') {
      this.mediaIndex = mediaIndex;
    }

    if (this.galleryIndex !== null && this.mediaIndex !== null) {
      const targetGallery = galleryStore.state.galleries[this.galleryIndex];
      if (targetGallery instanceof Gallery) {
        const targetMedia = targetGallery.findMedia(this.mediaIndex);
        if (targetMedia !== null) {
          this.applyData(targetGallery, targetMedia);
        } else {
          galleryActions.loadMoreGalleryMedias(this.galleryIndex);
        }
      } else {
        galleryActions.loadMoreGalleries();
      }
    }
  }

  applyData(gallery, media) {
    this.isLoading = false;
    this.data = media;

    this.isFirstInGallery = this.mediaIndex === 0;
    this.isFirst = this.isFirstInGallery && this.galleryIndex === 0;

    this.isLastInGallery = this.mediaIndex === gallery.totalMediaCount - 1;
    this.isLast = (
      this.isLastInGallery &&
      galleryStore.state.nextGalleriesPageUrl === null &&
      this.galleryIndex === galleryStore.state.galleries.length - 1
    )
  }
}

export const galleryStore = Reflux.initStore(GalleryStore);
