import React from 'react'
import alertify from 'alertifyjs'
import {InjectedRouter, PlainRoute} from 'react-router'
import {UNSAVED_CHANGES_WARNING} from 'js/protector/protectorConstants'

type TranslationsTabContentProps = {
  /**
   * This is a generic component, so it can't be hold responsible for any
   * protection logic - it needs to come from the outside.
   */
  shouldProtect: boolean
  /** A `this.props.route` from a route component. */
  currentRoute: PlainRoute<any>
  /** A `this.props.router` from a route component. */
  router: InjectedRouter
}

/**
 * A generic component to be used with router components to avoid losing unsaved
 * work. It blocks navigation behind a confirm - switching routes or moving to
 * different URL. If you need to safeguard something else, please use
 * `protectorHelpers`.
 */
export default class WorkProtector extends React.Component<
  TranslationsTabContentProps,
  {}
> {
  private removeRouterLeaveHook?: Function
  private onBeforeUnloadBound = this.onBeforeUnload.bind(this)

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

  /**
   * We want this to not render anything, but still be mountable by other
   * components - the reason is that it is simpler to pass props to such
   * non-renderable component than any other way.
   */
  render() {
    return null
  }
}
