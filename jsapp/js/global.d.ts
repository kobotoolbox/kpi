declare function t(str: string): string;

declare module 'alertifyjs' {
  const defaults: any
  const notify: (msg: string, type?: string) => void
}
