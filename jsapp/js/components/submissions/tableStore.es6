import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import {
  getRouteAssetUid,
  isFormTableRoute,
} from 'js/routerUtils';

const tableStore = Reflux.createStore({
  data: {
    hiddenFields: new Set(),
    frozenFields: new Set(),
    fieldSortValues: new Map(),
  },

  init() {
    hashHistory.listen(this.onRouteChange);
  },

  onRouteChange() {
    const assetUid = getRouteAssetUid();
    if (isFormTableRoute(assetUid)) {
      // refresh data when navigating into table view
      this.resetData();
    }
  },

  resetData() {
    this.data.hiddenFields.clear();
    this.data.frozenFields.clear();
    this.data.fieldSortValues.clear();
    this.trigger();
  },

  // public methods

  /**
   * @param {string} fieldId
   * @param {boolean} isHidden
   */
  setHiddenField(fieldId, isHidden) {
    if (isHidden === false) {
      this.data.hiddenFields.delete(fieldId);
    } else {
      this.data.hiddenFields.add(fieldId);
    }
    this.trigger();
  },

  /**
   * @param {string} fieldId
   * @returns {boolean}
   */
  isFieldHidden(fieldId) {
    return this.data.hiddenFields.has(fieldId);
  },

  /**
   * @param {string} fieldId
   * @param {boolean} isHidden
   */
  setFrozenField(fieldId, isFrozen) {
    if (isFrozen === false) {
      this.data.frozenFields.delete(fieldId);
    } else {
      this.data.frozenFields.add(fieldId);
    }
    this.trigger();
  },

  /**
   * @param {string} fieldId
   * @returns {boolean}
   */
  isFieldFrozen(fieldId) {
    return this.data.frozenFields.has(fieldId);
  },

  /**
   * @param {string} fieldId
   * @param {string} sortValue - one of SORT_VALUES
   */
  setFieldSortValue(fieldId, sortValue) {
    this.data.fieldSortValues.set(fieldId, sortValue);
    this.trigger();
  },

  /**
   * @param {string} fieldId
   * @returns {string|null} one of SORT_VALUES or `null` for no value
   */
  getFieldSortValue(fieldId) {
    if (this.data.fieldSortValues.has(fieldId)) {
      return this.data.fieldSortValues.get(fieldId);
    } else {
      return null;
    }
  },

  /**
   * @param {string} fieldId
   */
  removeFieldSortValue(fieldId) {
    this.data.fieldSortValues.delete(fieldId);
    this.trigger();
  },

  /**
   * @param {string} fieldId
   */
  hasFieldSortValue(fieldId) {
    return this.data.fieldSortValues.has(fieldId);
  },
});

export default tableStore;
