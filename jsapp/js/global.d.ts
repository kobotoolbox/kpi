/** Please pass only static strings and don't use concatenating (`+`). */
declare function t(str: string): string;

declare module 'alertifyjs' {
  const defaults: any
  const error: (msg: string) => void
  const notify: (msg: string, type?: string) => void
  const warning: (msg: string, time?: number) => {
    dismiss: Function
  }
  const dialog: (name: string) => {
    destroy: Function
    set: Function
    elements: {
      buttons: {
        primary: HTMLElement
      }
    }
  }
}

declare module 'react-autobind' {
  /**
   * NOTE: please DO NOT USE unless refactoring old code, as the autobind
   * project was abandoned years ago. Just use regular `.bind(this)`.
   */
  function autoBind(thisToBeBound: any): void
  export default autoBind
}
