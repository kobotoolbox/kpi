import {dataInterface} from 'js/dataInterface';
import {notify} from 'utils';

/**
 * For handling Enketo in DRY way.
 */
const enketoHandler = {
  enketoUrls: new Map(),
  winTab: null,

  /**
   * Builds unique url id.
   */
  _getUrlId(aid, sid) {
    return `${aid}…${sid}`;
  },

  _hasEnketoUrl(aid, sid) {
    return this.enketoUrls.has(this._getUrlId(aid, sid));
  },

  /**
   * Opens submission editing in new window.
   */
  _openEnketoUrl(aid, sid) {
    this.winTab.location.href = this.enketoUrls.get(this._getUrlId(aid, sid));
  },

  _saveEnketoUrl(aid, sid, url) {
    const urlId = this._getUrlId(aid, sid);
    this.enketoUrls.set(urlId, url);
    // store url for 30 seconds as configured in Enketo
    setTimeout(this._removeEnketoUrl.bind(this, aid, sid), 30 * 1000);
  },

  _removeEnketoUrl(aid, sid) {
    this.enketoUrls.delete(this._getUrlId(aid, sid));
  },

  /**
   * Opens submission url from cache or after getting it from endpoint.
   *
   * @param {string} aid - Asset id.
   * @param {string} sid - Submission id.
   *
   * @returns {Promise} Promise that resolves when url is being opened.
   */
  editSubmission(aid, sid) {
    // we create the tab immediately to avoid browser popup blocker killing it
    this.winTab = window.open('', '_blank');
    const editPromise = new Promise((resolve, reject) => {
      if (this._hasEnketoUrl(aid, sid)) {
        this._openEnketoUrl(aid, sid);
        resolve();
      } else {
        dataInterface.getEnketoEditLink(aid, sid)
          .done((editData) => {
            if (editData.url) {
              this._saveEnketoUrl(aid, sid, editData.url);
              this._openEnketoUrl(aid, sid);
              resolve();
            } else {
              let errorMsg = t('There was an error loading Enketo.');
              if (editData.detail) {
                errorMsg += `<br><code>${editData.detail}</code>`;
              }
              notify(errorMsg, 'error');
              reject();
            }
          })
          .fail(() => {
            notify(t('There was an error getting Enketo edit link'), 'error');
            reject();
          });
      }
    }).catch(() => {
      // close the blank tab since it will never load anything 😢
      // (and it obscures the error message)
      this.winTab.close();
    });
    return editPromise;
  }
};

export default enketoHandler;
