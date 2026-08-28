import React from 'react'

import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import { actions } from '#/actions'
import LoadingSpinner from '#/components/common/loadingSpinner'
import Modal from '#/components/common/modal'
import { LibraryAssetForm } from '#/components/modalForms/LibraryAssetForm'
import LibraryNewItemForm from '#/components/modalForms/LibraryNewItemForm'
import { ASSET_TYPES, MODAL_TYPES, PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import pageState from '#/pageState.store'
import { ProjectSettings } from '#/project/ProjectSettings'
import { stores } from '#/stores'
// This should either be more generic or else be it's own component in the account directory.
import MFAModals from './mfaModals'

/**
 * Custom modal component for displaying complex modals.
 *
 * It allows for displaying single modal at a time, as there is only single
 * modal element with adjustable title content.
 *
 * To display a modal, you need to use `pageState` store with `showModal` method:
 *
 * ```
 * pageState.showModal({
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
    super(props)
    this.state = {
      enketopreviewlink: false,
      error: false,
      modalClass: false,
    }
    autoBind(this)
  }

  componentDidMount() {
    var type = this.props.params.type
    switch (type) {
      case MODAL_TYPES.NEW_FORM:
        // title is set by formEditors
        break

      case MODAL_TYPES.LIBRARY_NEW_ITEM:
        this.setModalTitle(t('Create Library Item'))
        break

      case MODAL_TYPES.LIBRARY_TEMPLATE:
        this.setModalTitle(t('Template details'))
        break

      case MODAL_TYPES.LIBRARY_COLLECTION:
        this.setModalTitle(t('Collection details'))
        break

      case MODAL_TYPES.ENKETO_PREVIEW:
        this.listenTo(stores.snapshots, this.enketoSnapshotCreation)
        actions.resources.createSnapshot({
          asset: this.props.params.assetUrl,
        })

        this.setState({
          title: t('Form Preview'),
          modalClass: 'modal--large',
        })
        break

      case MODAL_TYPES.REPLACE_PROJECT:
        // title is set by formEditors
        break

      // TODO: Make a better generic modal component
      // See: https://github.com/kobotoolbox/kpi/issues/3643
      case MODAL_TYPES.MFA_MODALS:
        // Size and title will depend on its props
        this.setState({
          modalClass: 'modal--custom-header modal--mfa-setup',
        })
        break

      default:
        console.error(`Unknown modal type: "${type}"!`)
    }
  }

  /**
   * @param {string} title
   */
  setModalTitle(title) {
    this.setState({ title: title })
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
      })
    } else {
      this.setState({
        message: data.error,
        error: true,
      })
    }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.params) {
      // store for later
      return { prevType: props.params.type }
    }
    return null
  }

  onModalClose() {
    pageState.hideModal()
  }

  render() {
    return (
      <Modal
        open
        onClose={this.onModalClose}
        title={this.state.title}
        className={this.state.modalClass}
        isDuplicated={this.props.params.isDuplicated}
        customModalHeader={this.props.params.customModalHeader}
        disableBackdropClose={this.props.params.disableBackdropClose}
        disableEscClose={this.props.params.disableEscClose}
      >
        <Modal.Body>
          {this.props.params.type === MODAL_TYPES.NEW_FORM && (
            <ProjectSettings
              context={PROJECT_SETTINGS_CONTEXTS.NEW}
              onSetModalTitle={this.setModalTitle}
              initialTemplateUid={this.props.params.initialTemplateUid}
            />
          )}
          {this.props.params.type === MODAL_TYPES.LIBRARY_NEW_ITEM && (
            <LibraryNewItemForm onSetModalTitle={this.setModalTitle} />
          )}
          {this.props.params.type === MODAL_TYPES.LIBRARY_TEMPLATE && (
            <LibraryAssetForm
              asset={this.props.params.asset}
              assetType={ASSET_TYPES.template.id}
              onSetModalTitle={this.setModalTitle}
            />
          )}
          {this.props.params.type === MODAL_TYPES.LIBRARY_COLLECTION && (
            <LibraryAssetForm
              asset={this.props.params.asset}
              assetType={ASSET_TYPES.collection.id}
              onSetModalTitle={this.setModalTitle}
            />
          )}
          {this.props.params.type === MODAL_TYPES.REPLACE_PROJECT && (
            <ProjectSettings
              context={PROJECT_SETTINGS_CONTEXTS.REPLACE}
              onSetModalTitle={this.setModalTitle}
              formAsset={this.props.params.asset}
            />
          )}
          {this.props.params.type === MODAL_TYPES.ENKETO_PREVIEW && this.state.enketopreviewlink && (
            <div className='enketo-holder'>
              <iframe src={this.state.enketopreviewlink} allow='camera *; microphone *; geolocation *' />
            </div>
          )}
          {this.props.params.type === MODAL_TYPES.ENKETO_PREVIEW && !this.state.enketopreviewlink && <LoadingSpinner />}
          {this.props.params.type === MODAL_TYPES.ENKETO_PREVIEW && this.state.error && <div>{this.state.message}</div>}
          {this.props.params.type === MODAL_TYPES.MFA_MODALS && (
            <MFAModals onModalClose={this.onModalClose} {...this.props.params} />
          )}
        </Modal.Body>
      </Modal>
    )
  }
}

reactMixin(BigModal.prototype, Reflux.ListenerMixin)

export default BigModal
