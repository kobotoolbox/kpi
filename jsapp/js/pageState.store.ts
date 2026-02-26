import Reflux from 'reflux'

interface PageStateModalParams {
  type: string // one of MODAL_TYPES
  // TODO: this is dangerous, as we are not checking what we are passing around,
  // but since there are multiple completely different modals that use these
  // params, and we are planning to not use this modal component, refactoring
  // might be too much work.
  [name: string]: any
}

export interface PageStateStoreState {
  showFixedDrawer?: boolean
  modal?: PageStateModalParams | false
}

// TODO:
// This is some old weird store that is responsible for two things:
// 1. toggling mobile menu - should be moved to some other place
// 2. handling modal from `bigModal.js` - should be moved somewhere near the modal files
/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
class PageStateStore extends Reflux.Store {
  state: PageStateStoreState = {
    showFixedDrawer: false,
    modal: false,
  }

  setState(newState: PageStateStoreState) {
    Object.assign(this.state, newState)
    this.trigger(this.state)
  }

  toggleFixedDrawer() {
    const _changes: PageStateStoreState = {}
    const newval = !this.state.showFixedDrawer
    _changes.showFixedDrawer = newval
    Object.assign(this.state, _changes)
    this.trigger(_changes)
  }

  showModal(params: PageStateModalParams) {
    this.setState({
      modal: params,
    })
  }

  hideModal() {
    this.setState({
      modal: false,
    })
  }

  /**
   * Use it when you have one modal opened and want to display different one
   * (because just calling showModal has weird outcome).
   */
  switchModal(params: PageStateModalParams) {
    this.hideModal()
    // HACK switch to setState callback after updating to React 16+
    window.setTimeout(() => {
      this.showModal(params)
    }, 0)
  }

  /**
   * Use it when you have modal opened and want to go back to previous one.
   */
  switchToPreviousModal() {
    if (this.state.modal) {
      this.switchModal({
        type: this.state.modal.previousType,
      })
    }
  }

  hasPreviousModal() {
    return this.state.modal && this.state.modal?.previousType
  }
}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const pageState = new PageStateStore()

export default pageState
