export interface AttachedSourceItem {
  sourceName: string
  sourceUrl: string
  sourceUid: string
  isSourceDeleted: boolean
  linkedFields: string[]
  filename: string
  attachmentUrl: string
}

export interface ConnectableAsset {
  uid: string
  url: string
  name: string
}
