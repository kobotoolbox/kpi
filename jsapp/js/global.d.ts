/** Please pass only static strings and don't use concatenating (`+`). */
declare function t(str: string): string;

declare module 'alertifyjs' {
  const defaults: any
  const notify: (msg: string, type?: string) => void
}

declare module 'react-autobind' {
  /**
   * NOTE: please DO NOT USE unless refactoring old code, as the autobind
   * project was abandoned years ago. Just use regular `.bind(this)`.
   */
  function autoBind(thisToBeBound: any): void
  export default autoBind
}
