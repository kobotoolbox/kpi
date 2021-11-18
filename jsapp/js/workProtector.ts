import React from 'react'
import alertify from 'alertifyjs'

const UNSAVED_CHANGES_WARNING = t('You have unsaved changes. Leave settings without saving?')

type TranslationsTabContentProps = {
  shouldProtect: boolean
}

type TranslationsTabContentState = {}

export default class WorkProtector extends React.Component<
  TranslationsTabContentProps,
  TranslationsTabContentState
> {
  constructor(props: TranslationsTabContentProps) {
    super(props)
  }

  onBeforeUnloadBound = this.onBeforeUnload.bind(this)

  isProtecting = false

  /** Will stop navigating out of current route or url. */
  protectWork() {
    if (!this.isProtecting) {
      window.addEventListener('beforeunload', this.onBeforeUnloadBound)
      this.isProtecting = true
    }
  }

  /** Disable watching. */
  stopProtectingWork() {
    if (this.isProtecting) {
      window.removeEventListener('beforeunload', this.onBeforeUnloadBound)
      this.isProtecting = false
    }
  }

  onBeforeUnload(evt: BeforeUnloadEvent) {
    evt.preventDefault()
    evt.returnValue = true
  }

  displaySafeCloseConfirm(callback: Function) {
    const dialog = alertify.dialog('confirm')
    const opts = {
      title: UNSAVED_CHANGES_WARNING,
      labels: {ok: t('Close'), cancel: t('Cancel')},
      onok: callback,
      oncancel: dialog.destroy,
    }
    dialog.set(opts).show()
  }

  render() {
    return null
  }
}
