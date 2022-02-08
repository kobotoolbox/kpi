/** Please pass only static strings and don't use concatenating (`+`). */
declare function t(str: string): string;

/**
 * These are partial typings for alertifyjs module.
 * Please add any missing types you encounter.
 */
interface AlertifyJsModule {
  /** Custom dialogs. */
  [id: string]: any
  notify: (msg: string, type?: string) => void
  dialog: (
    /** For defining a new dialog type or using existing one. */
    dialogType: string,
    /** For creating a custom dialog type. */
    overrides?: () => {
      setContent?: Function
      setup: Function
      prepare: Function
      settings: {
        onclick: Function
      }
      callback: Function
    },
    /** Indicates whether to create a singleton or transient dialog */
    isTransient?: boolean,
    /** The name of dialog to inherit from. */
    baseDialogType?: string
  ) => {
    set: Function
    destroy: Function
  }
}
declare module 'alertifyjs' {
  const alertifyjsmodule: AlertifyJsModule = {}
  export = alertifyjsmodule
}

interface HashHistoryListenData {
  action: string
  hash: string
  key: string|null
  pathname: string
  query: {}
  search: string
  state: any
}

declare module 'react-autobind' {
  /**
   * NOTE: please DO NOT USE unless refactoring old code, as the autobind
   * project was abandoned years ago. Just use regular `.bind(this)`.
   */
  function autoBind(thisToBeBound: any): void
  export default autoBind
}
