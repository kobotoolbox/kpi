import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import {
  getRouteAssetUid,
  isFormTableRoute,
} from 'js/routerUtils';

const tableStore = Reflux.createStore({
  /**
   * NOTE: With current UI there could be:
   * - multiple hidden fields
   * - one frozen field
   * - one field sort value
   * but the store architecture allows all to be multiple in future easily!
   * @public
   */
  data: {
    hiddenFields: new Set(),
    frozenFields: new Set(),
    fieldSortValues: new Map(),
  },

  /**
   * @private
   */
  init() {
    hashHistory.listen(this.onRouteChange);
  },

  /**
   * @private
   */
  onRouteChange() {
    const assetUid = getRouteAssetUid();
    if (isFormTableRoute(assetUid)) {
      // refresh data when navigating into table view
      this.resetAllData();
    }
  },

  /**
   * @private
   */
  resetAllData() {
    this.data.hiddenFields.clear();
    this.data.frozenFields.clear();
    this.data.fieldSortValues.clear();
    this.trigger();
  },

  /**
   * Hidden fields handling methods.
   */

  /**
   * @param {string} fieldId
   * @param {boolean} isHidden
   * @public
   */
  setHiddenField(fieldId, isHidden) {
    if (isHidden === false) {
      this.data.hiddenFields.delete(fieldId);
    } else {
      this.data.hiddenFields.add(fieldId);

      // When hiding a field, we also unfreeze it and unsort it
      this.setFrozenField(fieldId, false, false);
      this.removeFieldSortValue(fieldId, false);
    }
    this.trigger();
  },

  /**
   * @param {string} fieldId
   * @returns {boolean}
   * @public
   */
  isFieldHidden(fieldId) {
    return this.data.hiddenFields.has(fieldId);
  },

  /**
   * Frozen fields handling methods.
   */

  /**
   * @param {string} fieldId
   * @param {boolean} isHidden
   * @param {boolean} [triggerListeners=true] - useful if another trigger will happen
   * @public
   */
  setFrozenField(fieldId, isFrozen, triggerListeners = true) {
    // As long as we want to support only one frozen field at a time, we need
    // to clear previous one first.
    this.data.frozenFields.clear();

    if (isFrozen === false) {
      this.data.frozenFields.delete(fieldId);
    } else {
      this.data.frozenFields.add(fieldId);
    }

    if (triggerListeners) {
      this.trigger();
    }
  },

  /**
   * @param {string} fieldId
   * @returns {boolean}
   * @public
   */
  isFieldFrozen(fieldId) {
    return this.data.frozenFields.has(fieldId);
  },

  /**
   * Field sort values handling methods.
   */

  /**
   * @param {string} fieldId
   * @param {string} sortValue - one of SORT_VALUES
   * @public
   */
  setFieldSortValue(fieldId, sortValue) {
    // As long as we want to support only one sort at a time, we need to clear
    // previous value first.
    this.data.fieldSortValues.clear();

    this.data.fieldSortValues.set(fieldId, sortValue);
    this.trigger();
  },

  /**
   * @param {string} fieldId
   * @returns {string|null} one of SORT_VALUES or `null` for no value
   * @public
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
   * @param {boolean} [triggerListeners=true] - useful if another trigger will happen
   * @public
   */
  removeFieldSortValue(fieldId, triggerListeners = true) {
    this.data.fieldSortValues.delete(fieldId);
    if (triggerListeners) {
      this.trigger();
    }
  },

  /**
   * @param {string} fieldId
   * @public
   */
  hasFieldSortValue(fieldId) {
    return this.data.fieldSortValues.has(fieldId);
  },
});

export default tableStore;
