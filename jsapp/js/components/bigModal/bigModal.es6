import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import {actions} from 'js/actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Modal from 'js/components/common/modal';
import {stores} from 'js/stores';
import {
  PROJECT_SETTINGS_CONTEXTS,
  MODAL_TYPES,
  ASSET_TYPES,
} from 'js/constants';
import {AssetTagsForm} from 'js/components/modalForms/assetTagsForm';
import {LibraryAssetForm} from 'js/components/modalForms/libraryAssetForm';
import LibraryNewItemForm from 'js/components/modalForms/libraryNewItemForm';
import LibraryUploadForm from 'js/components/modalForms/libraryUploadForm';
import EncryptForm from 'js/components/modalForms/encryptForm';
import BulkEditSubmissionsForm from 'js/components/modalForms/bulkEditSubmissionsForm';
import ProjectSettings from 'js/components/modalForms/projectSettings';
import RESTServicesForm from 'js/components/RESTServices/RESTServicesForm';
import SharingForm from 'js/components/permissions/sharingForm';
import DataAttachmentColumnsForm from 'js/components/dataAttachments/dataAttachmentColumnsForm';
import SubmissionModal from 'js/components/submissions/submissionModal';
import TableSettings from 'js/components/submissions/tableSettings';
import TableMediaPreview from 'js/components/submissions/tableMediaPreview';
import TranslationSettings from 'js/components/modalForms/translationSettings';
import TranslationTable from 'js/components/modalForms/translationTable';

function getSubmissionTitle(props) {
  let title = t('Success!');
  let p = props.params;
  let sid = parseInt(p.sid);

  if (!p.isDuplicated) {
    title = t('Submission Record');
    if (p.tableInfo) {
      let index = p.ids.indexOf(sid) + (p.tableInfo.pageSize * p.tableInfo.currentPage) + 1;
      title = `${t('Submission Record')} (${index} ${t('of')} ${p.tableInfo.resultsTotal})`;
    } else {
      let index = p.ids.indexOf(sid);
      if (p.ids.length === 1) {
        title = `${t('Submission Record')}`;
      } else {
        title = `${t('Submission Record')} (${index} ${t('of')} ${p.ids.length})`;
      }
    }
  }

  return title;
}

/**
 * Custom modal component for displaying complex modals.
 *
 * It allows for displaying single modal at a time, as there is only single
 * modal element with adjustable title content.
 *
 * To display a modal, you need to use `pageState` store with `showModal` method:
 *
 * ```
 * stores.pageState.showModal({
 *   type: MODAL_TYPES.NEW_FORM
 * });
 * ```
 *
 * Each modal type uses different props, you can add them in the above object.
 *
 * There are also two other important methods: `hideModal` and `switchModal`.
 *
 * @prop {object} params - to be passed to the custom modal component
 */
class BigModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      enketopreviewlink: false,
      error: false,
      modalClass: false,
    };
    autoBind(this);
  }

  componentDidMount() {
    var type = this.props.params.type;
    switch(type) {
      case MODAL_TYPES.SHARING:
        this.setModalTitle(t('Sharing Permissions'));
        break;

      case MODAL_TYPES.UPLOADING_XLS:
        var filename = this.props.params.filename || '';
        this.setState({
          title: t('Uploading XLS file'),
          message: t('Uploading: ') + filename,
        });
        break;

      case MODAL_TYPES.NEW_FORM:
        // title is set by formEditors
        break;

      case MODAL_TYPES.LIBRARY_NEW_ITEM:
        this.setModalTitle(t('Create Library Item'));
        break;

      case MODAL_TYPES.LIBRARY_TEMPLATE:
        this.setModalTitle(t('Template details'));
        break;

      case MODAL_TYPES.LIBRARY_COLLECTION:
        this.setModalTitle(t('Collection details'));
        break;

      case MODAL_TYPES.ASSET_TAGS:
        this.setModalTitle(t('Edit tags'));
        break;

      case MODAL_TYPES.LIBRARY_UPLOAD:
        this.setModalTitle(t('Upload file'));
        break;

      case MODAL_TYPES.ENKETO_PREVIEW:
        const uid = this.props.params.assetid || this.props.params.uid;
        stores.allAssets.whenLoaded(uid, (asset) => {
          actions.resources.createSnapshot({
            asset: asset.url,
          });
        });
        this.listenTo(stores.snapshots, this.enketoSnapshotCreation);

        this.setState({
          title: t('Form Preview'),
          modalClass: 'modal--large',
        });
        break;

      case MODAL_TYPES.SUBMISSION:
        this.setState({
          title: getSubmissionTitle(this.props),
          modalClass: 'modal--large modal-submission',
          sid: this.props.params.sid,
        });
      break;

      case MODAL_TYPES.REST_SERVICES:
        if (this.props.params.hookUid) {
          this.setState({title: t('Edit REST Service')});
        } else {
          this.setState({title: t('New REST Service')});
        }
        break;

      case MODAL_TYPES.REPLACE_PROJECT:
        // title is set by formEditors
        break;

      case MODAL_TYPES.TABLE_SETTINGS:
        this.setModalTitle(t('Table display options'));
        break;

      case MODAL_TYPES.FORM_LANGUAGES:
        this.setModalTitle(t('Manage Languages'));
        break;

      case MODAL_TYPES.FORM_TRANSLATIONS_TABLE:
        this.setState({
          title: t('Translations Table'),
          modalClass: 'modal--large',
        });
        break;

      case MODAL_TYPES.ENCRYPT_FORM:
        this.setModalTitle(t('Manage Form Encryption'));
        break;

      case MODAL_TYPES.BULK_EDIT_SUBMISSIONS:
        // title is set by BulkEditSubmissionsForm
        this.setState({
          modalClass: 'modal--large modal--large-shorter',
        });
        break;

      case MODAL_TYPES.TABLE_MEDIA_PREVIEW:
        // Size and title will depend on its props
        this.setState({
          modalClass: 'modal-media-preview'
        });
      case MODAL_TYPES.DATA_ATTACHMENT_COLUMNS:
        // title is set by DataAttachmentColumnsForm
        break;

      default:
        console.error(`Unknown modal type: "${type}"!`);
    }
  }

  /**
   * @param {string} title
   */
  setModalTitle(title) {
    this.setState({title: title});
  }

  /**
   * @param {object} data
   * @param {boolean} data.success
   * @param {string} data.error
   * @param {string} data.enketopreviewlink
   */
  enketoSnapshotCreation(data) {
    if (data.success) {
      this.setState({
        enketopreviewlink: data.enketopreviewlink,
      });
    } else {
      this.setState({
        message: data.error,
        error: true,
      });
    }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.params) {
      const newState = {};
      if (props.params.sid) {
        newState.title = getSubmissionTitle(props);
        newState.sid = props.params.sid;
      } else {
        newState.sid = false;
      }

      if (
        state.prevType !== props.params.type &&
        props.params.type === MODAL_TYPES.UPLOADING_XLS
      ) {
        var filename = props.params.filename || '';
        newState.title = t('Uploading XLS file');
        newState.message = t('Uploading: ') + filename;
      }

      // store for later
      newState.prevType = props.params.type;
      return newState;
    }
    return null;
  }

  /**
   * @param {string} title
   * @param {string} message
   */
  displaySafeCloseConfirm(title, message) {
    const dialog = alertify.dialog('confirm');
    const opts = {
      title: title,
      message: message,
      labels: {ok: t('Close'), cancel: t('Cancel')},
      onok: stores.pageState.hideModal,
      oncancel: dialog.destroy,
    };
    dialog.set(opts).show();
  }

  onModalClose() {
    if (
      this.props.params.type === MODAL_TYPES.FORM_TRANSLATIONS_TABLE &&
      stores.translations.state.isTranslationTableUnsaved
    ) {
      this.displaySafeCloseConfirm(
        t('Close Translations Table?'),
        t('You will lose all unsaved changes.')
      );
    } else {
      stores.pageState.hideModal();
    }
  }

  render() {
    const uid = this.props.params.assetid || this.props.params.uid;

    return (
      <Modal
        open
        onClose={this.onModalClose}
        title={this.state.title}
        className={this.state.modalClass}
        isDuplicated={this.props.params.isDuplicated}
        customModalHeader={this.props.params.customModalHeader}
      >
        <Modal.Body>
            { this.props.params.type === MODAL_TYPES.SHARING &&
              <SharingForm uid={uid} />
            }
            { this.props.params.type === MODAL_TYPES.NEW_FORM &&
              <ProjectSettings
                context={PROJECT_SETTINGS_CONTEXTS.NEW}
                onSetModalTitle={this.setModalTitle}
              />
            }
            { this.props.params.type === MODAL_TYPES.LIBRARY_NEW_ITEM &&
              <LibraryNewItemForm
                onSetModalTitle={this.setModalTitle}
              />
            }
            { this.props.params.type === MODAL_TYPES.LIBRARY_TEMPLATE &&
              <LibraryAssetForm
                asset={this.props.params.asset}
                assetType={ASSET_TYPES.template.id}
                onSetModalTitle={this.setModalTitle}
              />
            }
            { this.props.params.type === MODAL_TYPES.LIBRARY_COLLECTION &&
              <LibraryAssetForm
                asset={this.props.params.asset}
                assetType={ASSET_TYPES.collection.id}
                onSetModalTitle={this.setModalTitle}
              />
            }
            { this.props.params.type === MODAL_TYPES.ASSET_TAGS &&
              <AssetTagsForm
                asset={this.props.params.asset}
              />
            }
            { this.props.params.type === MODAL_TYPES.LIBRARY_UPLOAD &&
              <LibraryUploadForm
                onSetModalTitle={this.setModalTitle}
                file={this.props.params.file}
              />
            }
            { this.props.params.type === MODAL_TYPES.REPLACE_PROJECT &&
              <ProjectSettings
                context={PROJECT_SETTINGS_CONTEXTS.REPLACE}
                onSetModalTitle={this.setModalTitle}
                formAsset={this.props.params.asset}
              />
            }
            { this.props.params.type === MODAL_TYPES.ENKETO_PREVIEW && this.state.enketopreviewlink &&
              <div className='enketo-holder'>
                <iframe src={this.state.enketopreviewlink} />
              </div>
            }
            { this.props.params.type === MODAL_TYPES.ENKETO_PREVIEW && !this.state.enketopreviewlink &&
              <LoadingSpinner/>
            }
            { this.props.params.type === MODAL_TYPES.ENKETO_PREVIEW && this.state.error &&
              <div>
                {this.state.message}
              </div>
            }
            { this.props.params.type === MODAL_TYPES.UPLOADING_XLS &&
              <div>
                <LoadingSpinner message={this.state.message}/>
              </div>
            }
            { this.props.params.type === MODAL_TYPES.SUBMISSION && this.state.sid &&
              <SubmissionModal
                sid={this.state.sid}
                asset={this.props.params.asset}
                ids={this.props.params.ids}
                isDuplicated={this.props.params.isDuplicated}
                duplicatedSubmission={this.props.params.duplicatedSubmission}
                backgroundAudioUrl={this.props.params.backgroundAudioUrl}
                tableInfo={this.props.params.tableInfo || false}
              />
            }
            { this.props.params.type === MODAL_TYPES.SUBMISSION && !this.state.sid &&
              <div>
                <bem.Loading>
                  <bem.Loading__inner>
                    <i className='k-spin k-icon k-icon-spinner'/>
                  </bem.Loading__inner>
                </bem.Loading>
              </div>
            }
            { this.props.params.type === MODAL_TYPES.TABLE_SETTINGS &&
              <TableSettings
                asset={this.props.params.asset}
              />
            }
            { this.props.params.type === MODAL_TYPES.REST_SERVICES &&
              <RESTServicesForm
                assetUid={this.props.params.assetUid}
                hookUid={this.props.params.hookUid}
              />
            }
            { this.props.params.type === MODAL_TYPES.FORM_LANGUAGES &&
              <TranslationSettings
                asset={this.props.params.asset}
                assetUid={this.props.params.assetUid}
              />
            }
            { this.props.params.type === MODAL_TYPES.FORM_TRANSLATIONS_TABLE &&
              <TranslationTable
                asset={this.props.params.asset}
                langString={this.props.params.langString}
                langIndex={this.props.params.langIndex}
              />
            }
            { this.props.params.type === MODAL_TYPES.ENCRYPT_FORM &&
              <EncryptForm
                asset={this.props.params.asset}
                assetUid={this.props.params.assetUid}
              />
            }
            { this.props.params.type === MODAL_TYPES.BULK_EDIT_SUBMISSIONS &&
              <BulkEditSubmissionsForm
                onSetModalTitle={this.setModalTitle}
                onModalClose={this.onModalClose}
                asset={this.props.params.asset}
                {...this.props.params}
              />
            }
            { this.props.params.type === MODAL_TYPES.TABLE_MEDIA_PREVIEW &&
              <TableMediaPreview
                {...this.props.params}
              />
            }
            { this.props.params.type === MODAL_TYPES.DATA_ATTACHMENT_COLUMNS &&
              <DataAttachmentColumnsForm
                onSetModalTitle={this.setModalTitle}
                onModalClose={this.onModalClose}
                {...this.props.params}
              />
            }
        </Modal.Body>
      </Modal>
    );
  }
}

reactMixin(BigModal.prototype, Reflux.ListenerMixin);

export default BigModal;
