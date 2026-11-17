import React from 'react'

import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import Modal from '#/components/common/modal'
import { MODAL_TYPES } from '#/constants'
import pageState from '#/pageState.store'
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
 *   type: MODAL_TYPES.MFA_MODALS
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
      modalClass: false,
    }
    autoBind(this)
  }

  componentDidMount() {
    var type = this.props.params.type
    switch (type) {
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
        className={this.state.modalClass}
        isDuplicated={this.props.params.isDuplicated}
        customModalHeader={this.props.params.customModalHeader}
        disableBackdropClose={this.props.params.disableBackdropClose}
        disableEscClose={this.props.params.disableEscClose}
      >
        <Modal.Body>
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
