import React from 'react'
import alertify from 'alertifyjs'
import {InjectedRouter, PlainRoute} from 'react-router'

const UNSAVED_CHANGES_WARNING = t('Do you want to leave without saving?')

type TranslationsTabContentProps = {
  shouldProtect: boolean
  currentRoute: PlainRoute<any>
  router: InjectedRouter
}

type TranslationsTabContentState = {}

/**
 * A generic component to be used with router components to avoid losing unsaved
 * work. It blocks (behind a prompt) switching routes or moving to different URL.
 */
export default class WorkProtector extends React.Component<
  TranslationsTabContentProps,
  TranslationsTabContentState
> {
  private removeRouterLeaveHook?: Function
  private onBeforeUnloadBound = this.onBeforeUnload.bind(this)

  constructor(props: TranslationsTabContentProps) {
    super(props)
  }

  componentDidMount() {
    // This listens to react router changing routes.
    this.removeRouterLeaveHook = this.props.router.setRouteLeaveHook(
      this.props.currentRoute,
      this.onRouterLeave.bind(this)
    )
    // This listens to leaving the url.
    window.addEventListener('beforeunload', this.onBeforeUnloadBound)
  }

  componentWillUnmount() {
    if (this.removeRouterLeaveHook) {
      this.removeRouterLeaveHook()
      delete this.removeRouterLeaveHook
    }
    window.removeEventListener('beforeunload', this.onBeforeUnloadBound)
  }

  onRouterLeave() {
    if (this.props.shouldProtect) {
      return UNSAVED_CHANGES_WARNING
    }
    return undefined
  }

  onBeforeUnload(evt: BeforeUnloadEvent) {
    if (this.props.shouldProtect) {
      evt.preventDefault()
      evt.returnValue = true
    }
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
