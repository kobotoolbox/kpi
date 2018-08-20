import Reflux from 'reflux';
import {
  assign,
  stateChanges
} from 'js/utils';
import {GALLERY_FILTER_OPTIONS} from 'js/constants';

export const galleryActions = Reflux.createActions([
  'setFilters'
]);

class GalleryStore extends Reflux.Store {
  constructor() {
    super();
    this.listenables = galleryActions;
    this.state = this.getInitialState();
  }

  getInitialState() {
    return {
      filterQuery: '',
      filterGroupBy: GALLERY_FILTER_OPTIONS.question
    };
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
