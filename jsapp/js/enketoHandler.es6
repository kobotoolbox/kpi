import {ENKETO_ACTIONS} from 'js/constants'
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
  _getUrlId(aid, sid, action) {
    return `${aid}-${sid}-${action}`;
  },

  _hasEnketoUrl(urlId) {
    return this.enketoUrls.has(urlId);
  },

  /**
   * Opens submission in new window.
   */
  _openEnketoUrl(urlId) {
    this.winTab.location.href = this.enketoUrls.get(urlId);
  },

  _saveEnketoUrl(urlId, url) {
    this.enketoUrls.set(urlId, url);
    // store url for 30 seconds as configured in Enketo
    setTimeout(this._removeEnketoUrl.bind(this, urlId), 30 * 1000);
  },

  _removeEnketoUrl(urlId) {
    this.enketoUrls.delete(urlId);
  },

  /**
   * Opens submission url from cache or after getting it from endpoint.
   *
   * @param {string} aid - Asset id.
   * @param {string} sid - Submission id.
   *
   * @returns {Promise} Promise that resolves when url is being opened.
   */
  openSubmission(aid, sid, action) {
    // we create the tab immediately to avoid browser popup blocker killing it
    this.winTab = window.open('', '_blank');
    let dataIntMethod = dataInterface.getEnketoEditLink;
    if ( action === ENKETO_ACTIONS.view ) {
      dataIntMethod = dataInterface.getEnketoViewLink;
    }
    const urlId = this._getUrlId(aid, sid, action);
    const enketoPromise = new Promise((resolve, reject) => {
      if (this._hasEnketoUrl(urlId)) {
        this._openEnketoUrl(urlId);
        resolve();
      } else {
        dataIntMethod(aid, sid)
          .done((enketoData) => {
            if (enketoData.url) {
              this._saveEnketoUrl(urlId, enketoData.url);
              this._openEnketoUrl(urlId);
              resolve();
            } else {
              let errorMsg = t('There was an error loading Enketo.');
              if (enketoData.detail) {
                errorMsg += `<br><code>${enketoData.detail}</code>`;
              }
              notify(errorMsg, 'error');
              reject();
            }
          })
          .fail(() => {
            notify(t('There was an error getting Enketo link'), 'error');
            reject();
          });
      }
    }).catch(() => {
      // close the blank tab since it will never load anything 😢
      // (and it obscures the error message)
      this.winTab.close();
    });
    return enketoPromise;
  },
};

export default enketoHandler;
