import Reflux from 'reflux';
import {assign} from 'js/utils';
import {GALLERY_FILTER_OPTIONS} from 'js/constants';

function changes(orig_obj, new_obj) {
  var out = {},
      any = false;
  Object.keys(new_obj).forEach(function(key) {
    if (orig_obj[key] !== new_obj[key]) {
      out[key] = new_obj[key];
      any = true;
    }
  });
  if (!any) {
    return false;
  }
  return out;
}

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

  setState(state) {
    var chz = changes(this.state, state);
    if (chz) {
      assign(this.state, state);
      this.trigger(chz);
    }
  }
}

export const galleryStore = Reflux.initStore(GalleryStore);
