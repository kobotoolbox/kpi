import React from 'react';
import {EnketoActions} from 'js/constants'
import {dataInterface} from 'js/dataInterface';
import type {EnketoLinkResponse} from 'js/dataInterface';
import {notify} from 'js/utils';

/**
 * For handling Enketo in DRY way.
 */
class EnketoHandler {
  /** Map of `urlId`s (see `_getUrlId`) pointing to urls */
  enketoUrls: Map<string, string> = new Map();
  winTab: null | WindowProxy = null;

  /**
   * Builds unique url id.
   */
  _getUrlId(assetUid: string, submissionUid: string, action: EnketoActions) {
    return `${assetUid}-${submissionUid}-${action}`;
  }

  _hasEnketoUrl(urlId: string) {
    return this.enketoUrls.has(urlId);
  }

  /**
   * Opens submission in new window.
   */
  _openEnketoUrl(urlId: string) {
    const enketoUrl = this.enketoUrls.get(urlId);
    if (this.winTab !== null && enketoUrl !== undefined) {
      this.winTab.location.href = enketoUrl;
    } else {
      notify.error(t('Could not open window for "##url##"').replace('##url##', String(enketoUrl)));
    }
  }

  _saveEnketoUrl(urlId: string, url: string) {
    this.enketoUrls.set(urlId, url);
    // store url for 30 seconds as configured in Enketo
    setTimeout(this._removeEnketoUrl.bind(this, urlId), 30 * 1000);
  }

  _removeEnketoUrl(urlId: string) {
    this.enketoUrls.delete(urlId);
  }

  /**
   * Opens submission url from cache or after getting it from endpoint.
   * @returns {Promise} Promise that resolves when url is being opened.
   */
  openSubmission(assetUid: string, submissionUid: string, action: EnketoActions) {
    // we create the tab immediately to avoid browser popup blocker killing it
    this.winTab = window.open('', '_blank');

    let dataIntMethod = dataInterface.getEnketoEditLink;
    if (action === EnketoActions.view) {
      dataIntMethod = dataInterface.getEnketoViewLink;
    }

    const urlId = this._getUrlId(assetUid, submissionUid, action);

    const enketoPromise = new Promise((resolve, reject) => {
      if (this._hasEnketoUrl(urlId)) {
        this._openEnketoUrl(urlId);
        resolve(false);
      } else {
        dataIntMethod(assetUid, submissionUid)
          .always((enketoData: EnketoLinkResponse) => {
            if (enketoData.url) {
              this._saveEnketoUrl(urlId, enketoData.url);
              this._openEnketoUrl(urlId);
              resolve(false);
            } else {
              const errorMsg = (
                <div>
                  {t('There was an error loading Enketo.')}
                  {enketoData?.responseJSON?.detail && (
                    <div>
                      <br />
                      <code>{enketoData.responseJSON.detail}</code>
                    </div>
                  )}
                </div>
              );

              notify.error(errorMsg);
              reject(false);
            }
          });
      }
    }).catch(() => {
      // close the blank tab since it will never load anything 😢
      // (and it obscures the error message)
      this.winTab?.close();
    });

    return enketoPromise;
  }
};

const enketoHandler = new EnketoHandler();
export default enketoHandler;
