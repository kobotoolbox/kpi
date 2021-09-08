declare function t(str: string): string;

declare module 'alertifyjs' {
  const defaults: any
  const notify: (msg: string, type?: string) => void
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
