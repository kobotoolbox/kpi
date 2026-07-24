export interface PageStateModalParams {
  type: string
  // TODO: this is dangerous, as we are not checking what we are passing around,
  // but since there are multiple completely different modals that use these
  // params, and we are planning to not use this modal component, refactoring
  // might be too much work.
  [name: string]: any
}

export interface PageStateStoreState {
  modal?: PageStateModalParams | false
}

type PageStateListener = (state: PageStateStoreState) => void

let _snapshot: PageStateStoreState = { modal: false }
const _listeners = new Set<PageStateListener>()

/** @deprecated Migrate callers to Mantine modal patterns. */
const pageState = {
  get state(): PageStateStoreState {
    return _snapshot
  },

  listen(callback: PageStateListener): () => void {
    _listeners.add(callback)
    return () => _listeners.delete(callback)
  },

  showModal(params: PageStateModalParams): void {
    _snapshot = { modal: params }
    _listeners.forEach((l) => l(_snapshot))
  },

  hideModal(): void {
    _snapshot = { modal: false }
    _listeners.forEach((l) => l(_snapshot))
  },

  switchModal(params: PageStateModalParams): void {
    _snapshot = { modal: false }
    _listeners.forEach((l) => l(_snapshot))
    // Brief unmount/remount cycle so child components reset their state.
    window.setTimeout(() => {
      _snapshot = { modal: params }
      _listeners.forEach((l) => l(_snapshot))
    }, 0)
  },

  switchToPreviousModal(): void {
    const currentModal = _snapshot.modal
    if (currentModal && currentModal.previousType) {
      const previousType: string = currentModal.previousType
      _snapshot = { modal: false }
      _listeners.forEach((l) => l(_snapshot))
      window.setTimeout(() => {
        _snapshot = { modal: { type: previousType } }
        _listeners.forEach((l) => l(_snapshot))
      }, 0)
    }
  },

  hasPreviousModal(): boolean {
    const modal = _snapshot.modal
    return !!(modal && modal.previousType)
  },
}

export default pageState
