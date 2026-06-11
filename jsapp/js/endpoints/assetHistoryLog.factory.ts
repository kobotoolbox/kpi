import { type ActivityLogsItem, AuditActions } from '#/components/activity/activity.constants'

export const defaultAssetHistoryAssetUid = 'a1234567890bcdEFGhijkl'

type AssetHistoryLogFactoryOverrides = Partial<Omit<ActivityLogsItem, 'metadata'>> & {
  metadata?: Partial<ActivityLogsItem['metadata']>
}

export default function assetHistoryLogFactory(overrides: AssetHistoryLogFactoryOverrides = {}): ActivityLogsItem {
  const { metadata, ...rest } = overrides

  return {
    user: '/api/v2/users/john/',
    user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
    username: 'john',
    action: AuditActions['update-content'],
    metadata: {
      source: 'Firefox (Mac OS X)',
      asset_uid: defaultAssetHistoryAssetUid,
      ip_address: '192.168.107.1',
      ...metadata,
    },
    date_created: '2025-04-15T11:31:30Z',
    ...rest,
  }
}
