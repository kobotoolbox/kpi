/** Please pass only static strings and don't use concatenating (`+`). */
declare function t(str: string): string;

// NOTE: all alertify typings are written manually and could be wrong!
// I based them upon JSDoc comments in the source code (for parts of it),
// and on the console.log output of a dialog instance.

interface AlertifyDialogSettings {
  message?: string | null;
  labels?: {
    ok?: string;
    cancel?: string;
  } | null;
  onok?: Function | null;
  oncancel?: Function | null;
  defaultFocus?: boolean | null;
  reverseButtons?: boolean | null;
}

interface AlertifyDialogInstance {
  /** It is advised to not use internal. */
  __internal: {
    isOpen: boolean;
    activeElement: {
      [key: string]: any;
    };
    timerIn: number;
    buttons: Array<{
      text: string;
      key: number;
      className: string;
      element: any;
    }>;
    focus: {
      element: number;
      select: boolean;
    };
    options: {
      title: string;
      modal: boolean;
      basic: boolean;
      frameless: boolean;
      defaultFocusOff: boolean;
      pinned: boolean;
      movable: boolean;
      moveBounded: boolean;
      resizable: boolean;
      autoReset: boolean;
      closable: boolean;
      closableByDimmer: boolean;
      invokeOnCloseOff: boolean;
      maximizable: boolean;
      startMaximized: boolean;
      pinnable: boolean;
      transition: string;
      transitionOff: boolean;
      padding: boolean;
      overflow: boolean;
    };
  };
  __settings: AlertifyDialogSettings;
  autoCancel: (duration: number) => void;
  autoOk: (duration: number) => void;
  bringToFront: Function;
  build: Function;
  callback: (closeEvent: any) => void;
  close: Function;
  closeOthers: Function;
  destroy: Function;
  elements: {
    root: HTMLElement;
    dimmer: HTMLElement;
    modal: HTMLElement;
    dialog: HTMLElement;
    reset: [HTMLElement, HTMLElement];
    commands: {
      container: HTMLElement;
      pin: HTMLElement;
      maximize: HTMLElement;
      close: HTMLElement;
    };
    header: HTMLElement;
    body: HTMLElement;
    content: HTMLElement;
    footer: HTMLElement;
    resizeHandle: HTMLElement;
    buttons: {
      auxiliary: HTMLElement;
      primary: HTMLElement;
    };
    buttonTemplate: HTMLElement;
  };
  get: (key: string) => any;
  hooks: {};
  isMaximized: Function;
  isModal: Function;
  isOpen: Function;
  isPinned: Function;
  main: (
    _title?: string,
    _message?: string,
    _onok?: Function,
    _oncancel?: Function
  ) => any;
  maximize: Function;
  moveTo: (x: number, y: number) => void;
  pin: Function;
  prepare: Function;
  resizeTo: (width: number, height: number) => void;
  restore: Function;
  /** Pass whole object or two parameters. Returns back the updated instance? */
  set: (keyOrObject: AlertifyDialogSettings | string, value?: any) => AlertifyDialogInstance;
  setContent: (content: any) => void;
  setHeader: (content: any) => void;
  setMessage: (message: string) => void;
  setting: (key: string, value: any) => any;
  settingUpdated: (key: string, oldValue: any, newValue: any) => any;
  settings: AlertifyDialogSettings;
  setup: Function;
  show: (modal?: any, className?: string) => void;
  showModal: (className: string) => void;
  unpin: Function;
}

type AlertifyDialogFactory = () => {
  setContent?: Function;
  setup: Function;
  prepare: Function;
  settings: {
    onclick: Function;
  };
  callback: Function;
};

/**
 * These are partial typings for alertifyjs module.
 * Please add any missing types you encounter.
 */
interface AlertifyJsModule {
  /** Alertify defaults */
  defaults: defaults;
  /** Dialogs factory */
  dialog: (
    /** Dialog name. */
    name: string,
    /** A Dialog factory function. */
    factory?: AlertifyDialogFactory,
    /** Indicates whether to create a singleton or transient dialog. */
    transient?: boolean,
    /** The name of the base type to inherit from. */
    base?: string
  ) => AlertifyDialogInstance;
  /** Close all open dialogs. */
  closeAll: (except?: AlertifyDialogInstance) => void;
  /**
   * Gets or Sets dialog settings/options.
   * If the dialog is transient, this call does nothing.
   */
  setting: (
    /** The dialog name. */
    name: string,
    /** A string specifying a propery name or a collection of key/value pairs. */
    key: string | {},
    /** The value associated with the key (in case it was a string). */
    value?: any
  ) => any | void;
  /** Alias to `setting`, please do not use. */
  set: Function;
  /** Alias to `setting`, please do not use. */
  get: Function;
  /**
   * Creates a new notification message.
   * If a type is passed, a class name "ajs-{type}" will be added.
   * This allows for custom look and feel for various types of notifications.
   */
  notify: (
    /** Message text */
    message: Element | string,
    /** Type of log message */
    type?: string,
    /** Time (in seconds) to wait before auto-close */
    wait?: string,
    /** A callback function to be invoked when the log is closed. */
    callback?: Function
  ) => any;
  /** Creates a new notification message. */
  message: (
    /** Message text */
    message: string,
    /** Time (in seconds) to wait before auto-close */
    wait?: string,
    /** A callback function to be invoked when the log is closed. */
    callback?: Function
  ) => any;
  /** Creates a new notification message of type 'success'. */
  success: (
    /** Message text */
    message: string,
    /** Time (in seconds) to wait before auto-close */
    wait?: string,
    /** A callback function to be invoked when the log is closed. */
    callback?: Function
  ) => any;
  /** Creates a new notification message of type 'error'. */
  error: (
    /** Message text */
    message: string,
    /** Time (in seconds) to wait before auto-close */
    wait?: string,
    /** A callback function to be invoked when the log is closed. */
    callback?: Function
  ) => any;
  /** Creates a new notification message of type 'warning'. */
  warning: (
    /** Message text */
    message: string,
    /** Time (in seconds) to wait before auto-close */
    wait?: number,
    /** A callback function to be invoked when the log is closed. */
    callback?: Function
  ) => any;
  /** Dismisses all open notifications */
  dismissAll: Function;

  /** Custom dialogs. */
  [id: string]: any;
}
declare module 'alertifyjs' {
  const alertifyjsmodule: AlertifyJsModule = {};
  export = alertifyjsmodule;
}

interface HashHistoryListenData {
  action: string;
  hash: string;
  key: string|null;
  pathname: string;
  query: {};
  search: string;
  state: any;
}

declare module 'react-autobind' {
  /**
   * @deprecated Use regular `.bind(this)`.
   */
  function autoBind(thisToBeBound: any): void;
  export default autoBind;
}

declare module '*.module.scss';
declare module '*.module.css';
