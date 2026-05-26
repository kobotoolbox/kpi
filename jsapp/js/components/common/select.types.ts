export interface ComboboxStringItem<T extends string> {
  value: T
  disabled?: boolean
}

export interface ComboboxItem<T extends string> extends ComboboxStringItem<T> {
  label: string
}

export interface ComboboxItemGroup<T extends string, Item = ComboboxItem<T> | T> {
  group: string
  items: Item[]
}

export type ComboboxData<T extends string> =
  | Array<string | ComboboxItem<T> | ComboboxItemGroup<T>>
  | ReadonlyArray<string | ComboboxItem<T> | ComboboxItemGroup<T>>
