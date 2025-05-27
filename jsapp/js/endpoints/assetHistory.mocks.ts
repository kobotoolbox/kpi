import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import { type ActivityLogsItem, AuditActions, AuditSubTypes } from '#/components/activity/activity.constants'
import type { PaginatedResponse } from '#/dataInterface'

export const mockAssetUid = 'a1234567890bcdEFGhijkl'

/**
 * Mock API for project activity (AKA history logs). Use it in Storybook tests in `parameters.msw.handlers[]`.
 */
const assetHistoryMock = http.get<PathParams<'limit' | 'offset' | 'q'>, never, PaginatedResponse<ActivityLogsItem>>(
  endpoints.ASSET_HISTORY.replace(':asset_uid', mockAssetUid),
  (info) => {
    const searchParams = new URL(info.request.url).searchParams
    if (searchParams.get('q') === 'action:add-media') {
      return HttpResponse.json(assetHistoryFilteredResponse)
    } else if (searchParams.get('limit') === '10' && searchParams.get('offset') === '20') {
      return HttpResponse.json(assetHistoryResponsePage3)
    } else if (searchParams.get('limit') === '10' && searchParams.get('offset') === '10') {
      return HttpResponse.json(assetHistoryResponsePage2)
    } else {
      return HttpResponse.json(assetHistoryResponsePage1)
    }
  },
)
export default assetHistoryMock

const assetHistoryResponsePage1: PaginatedResponse<ActivityLogsItem> = {
  count: 26,
  next: '/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&offset=10&q=NOT+action%3A%27add-submission%27',
  previous: null,
  results: [
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: ['view_submissions'],
          removed: ['partial_submissions'],
          username: 'zefir',
        },
      },
      date_created: '2025-04-25T13:41:20Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '06c6421b-1917-4fd8-9d56-0033bf05f925',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-22T08:38:24Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '61175e5d-f1a2-4511-92d7-0fd0a6ae4942',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-22T08:38:24Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '5913ab53-1698-4930-8f69-797a36e957c3',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-22T08:38:24Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: 'a5ebf21b-c859-4ec2-8daf-a4a81596510d',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-22T08:38:24Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '0f411e44-073f-498d-92bc-42c941aca526',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-22T08:38:24Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: 'e06c4056-8453-42eb-ad39-7e7eb1652507',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-22T08:38:24Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '96656184-e878-4b1e-bf7c-a536703c1ba2',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-22T08:38:24Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['disallow-anonymous-submissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
      },
      date_created: '2025-04-22T08:38:02Z',
    },
    {
      user: '/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: [
            'partial_submissions',
            {
              code: 'add_submissions',
              filters: [
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
            {
              code: 'change_submissions',
              filters: [
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
            {
              code: 'view_submissions',
              filters: [
                {
                  _submitted_by: {
                    $in: ['jackie', 'john'],
                  },
                },
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
          ],
          removed: [],
          username: 'zefir',
        },
      },
      date_created: '2025-04-22T08:35:56Z',
    },
  ],
}

const assetHistoryResponsePage2: PaginatedResponse<ActivityLogsItem> = {
  count: 26,
  next: 'http://kf.kobo.local/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&offset=20&q=NOT+action%3A%27add-submission%27',
  previous:
    'http://kf.kobo.local/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&q=NOT+action%3A%27add-submission%27',
  results: [
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: [
            'partial_submissions',
            {
              code: 'add_submissions',
              filters: [
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
            {
              code: 'change_submissions',
              filters: [
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
            {
              code: 'view_submissions',
              filters: [
                {
                  _submitted_by: '*',
                },
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
          ],
          removed: [],
          username: 'zefir',
        },
      },
      date_created: '2025-04-22T08:35:27Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: [],
          removed: ['manage_asset', 'validate_submissions', 'change_submissions', 'change_asset', 'delete_submissions'],
          username: 'jackie',
        },
      },
      date_created: '2025-04-22T08:29:23Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: ['add_submissions', 'view_submissions', 'view_asset'],
          removed: [],
          username: 'john',
        },
      },
      date_created: '2025-04-22T08:29:14Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: [
            'add_submissions',
            'partial_submissions',
            {
              code: 'add_submissions',
              filters: [
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
            {
              code: 'change_submissions',
              filters: [
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
            {
              code: 'view_submissions',
              filters: [
                {
                  _submitted_by: 'jackie',
                },
              ],
            },
          ],
          removed: [],
          username: 'zefir',
        },
      },
      date_created: '2025-04-22T08:28:53Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: [
            'manage_asset',
            'validate_submissions',
            'change_submissions',
            'change_asset',
            'add_submissions',
            'view_asset',
            'view_submissions',
            'delete_submissions',
          ],
          removed: [],
          username: 'jackie',
        },
      },
      date_created: '2025-04-22T08:28:37Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: 'e06c4056-8453-42eb-ad39-7e7eb1652507',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-16T08:02:00Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '96656184-e878-4b1e-bf7c-a536703c1ba2',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-16T07:59:21Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '96656184-e878-4b1e-bf7c-a536703c1ba2',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-16T07:58:54Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '96656184-e878-4b1e-bf7c-a536703c1ba2',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-16T07:56:42Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['delete-submission'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        submission: {
          root_uuid: '96656184-e878-4b1e-bf7c-a536703c1ba2',
          submitted_by: 'AnonymousUser',
        },
        log_subtype: AuditSubTypes.project,
        project_owner: 'kobo',
      },
      date_created: '2025-04-16T07:49:58Z',
    },
  ],
}

const assetHistoryResponsePage3: PaginatedResponse<ActivityLogsItem> = {
  count: 26,
  next: null,
  previous:
    'http://kf.kobo.local/api/v2/assets/a1234567890bcdEFGhijkl/history/?limit=10&offset=10&q=NOT+action%3A%27add-submission%27',
  results: [
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: ['view_asset'],
          removed: [],
          username: 'zefir',
        },
      },
      date_created: '2025-04-16T07:37:22Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['modify-user-permissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
        permissions: {
          added: ['view_asset'],
          removed: [],
          username: 'zefir',
        },
      },
      date_created: '2025-04-16T07:36:29Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/karina/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTx',
      username: 'karina',
      action: AuditActions['add-media'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        'asset-file': {
          uid: 'afRwzbjzPQvJRhxic8qzXc7',
          filename: 'secrets.zip',
          md5_hash: 'md5:46f405aafd79d8698efcb4eb8abaa083',
          download_url: '/assets/a1234567890bcdEFGhijkl/files/afRwzbjzPQvJRhxic8qzXc7/content/',
        },
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.project,
      },
      date_created: '2025-04-15T11:34:17Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['allow-anonymous-submissions'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.permission,
      },
      date_created: '2025-04-15T11:31:49Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['deploy'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.project,
        latest_version_uid: 'vgFzDVpq4LgwkXH45d6d5H',
        latest_deployed_version_uid: 'vgFzDVpq4LgwkXH45d6d5H',
      },
      date_created: '2025-04-15T11:31:36Z',
    },
    {
      user: 'http://kf.kobo.local/api/v2/users/kobo/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTZ',
      username: 'kobo',
      action: AuditActions['update-content'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.project,
        latest_version_uid: 'vgFzDVpq4LgwkXH45d6d5H',
      },
      date_created: '2025-04-15T11:31:30Z',
    },
  ],
}

/**
 * Response to be used when filtering by action `add-media`.
 */
const assetHistoryFilteredResponse: PaginatedResponse<ActivityLogsItem> = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      user: 'http://kf.kobo.local/api/v2/users/karina/',
      user_uid: 'umBqhq3XSkkeNEzrFpCfTx',
      username: 'karina',
      action: AuditActions['add-media'],
      metadata: {
        source: 'Firefox (Mac OS X)',
        asset_uid: 'a1234567890bcdEFGhijkl',
        'asset-file': {
          uid: 'afRwzbjzPQvJRhxic8qzXc7',
          filename: 'secrets.zip',
          md5_hash: 'md5:46f405aafd79d8698efcb4eb8abaa083',
          download_url: '/assets/a1234567890bcdEFGhijkl/files/afRwzbjzPQvJRhxic8qzXc7/content/',
        },
        ip_address: '192.168.107.1',
        log_subtype: AuditSubTypes.project,
      },
      date_created: '2025-04-15T11:34:17Z',
    },
  ],
}
