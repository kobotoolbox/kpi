/**
 * Form Media related actions
 */

import Reflux from 'reflux'
import { dataInterface } from '#/dataInterface'
import { notify } from '#/utils'

const FORM_MEDIA_FILE_TYPE = 'form_media'

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const formMediaActions = Reflux.createActions({
  loadMedia: { children: ['completed', 'failed'] },
  uploadMedia: { children: ['completed', 'failed'] },
  deleteMedia: { children: ['completed', 'failed'] },
})

formMediaActions.uploadMedia.listen((uid, formMediaJSON) => {
  dataInterface
    .postFormMedia(uid, formMediaJSON)
    .done(() => {
      formMediaActions.uploadMedia.completed(uid)
    })
    .fail(formMediaActions.uploadMedia.failed)
})
formMediaActions.uploadMedia.completed.listen((uid) => {
  formMediaActions.loadMedia(uid)
})
formMediaActions.uploadMedia.failed.listen(() => {
  notify.error(t('Could not upload your media'))
})

formMediaActions.loadMedia.listen((uid) => {
  dataInterface
    .getAssetFiles(uid, FORM_MEDIA_FILE_TYPE)
    .done(formMediaActions.loadMedia.completed)
    .fail(formMediaActions.loadMedia.failed)
})
formMediaActions.loadMedia.failed.listen(() => {
  notify.error(t('Something went wrong with getting your media'))
})

formMediaActions.deleteMedia.listen((uid, url) => {
  dataInterface
    .deleteFormMedia(url)
    .done(() => {
      formMediaActions.deleteMedia.completed(uid)
    })
    .fail(formMediaActions.deleteMedia.failed)
})
formMediaActions.deleteMedia.completed.listen((uid) => {
  notify(t('Successfully deleted media'))
  formMediaActions.loadMedia(uid)
})
formMediaActions.deleteMedia.failed.listen(() => {
  notify.error(t('Failed to delete media!'))
})

export default formMediaActions
