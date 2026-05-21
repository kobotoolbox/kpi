export interface TranslationRowItem {
  original: string
  value: string | null
  name: string
  listName?: string
  itemProp: string
  contentProp: 'survey' | 'choices'
  isLabelLocked: boolean
}
