import type { PaginatedResponse, PermissionResponse, PermissionsConfigResponse } from '#/dataInterface'
import type { PermsFormDataPartialWithUsername } from './permParser'

/**
 * Mock permissions endpoints responses for tests.
 *
 * NOTE: For simplicity we assume that ROOT_URL is empty string.
 */

// /api/v2/permissions/
const permissions: PermissionsConfigResponse = {
  count: 10,
  next: null,
  previous: null,
  results: [
    {
      url: '/api/v2/permissions/add_submissions/',
      codename: 'add_submissions',
      implied: ['/api/v2/permissions/view_asset/'],
      contradictory: [],
      name: 'Can submit data to asset',
    },
    {
      url: '/api/v2/permissions/change_asset/',
      codename: 'change_asset',
      implied: ['/api/v2/permissions/view_asset/'],
      contradictory: [],
      name: 'Can change asset',
    },
    {
      url: '/api/v2/permissions/change_submissions/',
      codename: 'change_submissions',
      implied: [
        '/api/v2/permissions/add_submissions/',
        '/api/v2/permissions/view_asset/',
        '/api/v2/permissions/view_submissions/',
      ],
      contradictory: ['/api/v2/permissions/partial_submissions/'],
      name: 'Can modify submitted data for asset',
    },
    {
      url: '/api/v2/permissions/delete_submissions/',
      codename: 'delete_submissions',
      implied: ['/api/v2/permissions/view_asset/', '/api/v2/permissions/view_submissions/'],
      contradictory: ['/api/v2/permissions/partial_submissions/'],
      name: 'Can delete submitted data for asset',
    },
    {
      url: '/api/v2/permissions/discover_asset/',
      codename: 'discover_asset',
      implied: ['/api/v2/permissions/view_asset/'],
      contradictory: [],
      name: 'Can discover asset in public lists',
    },
    {
      url: '/api/v2/permissions/manage_asset/',
      codename: 'manage_asset',
      implied: [
        '/api/v2/permissions/delete_submissions/',
        '/api/v2/permissions/validate_submissions/',
        '/api/v2/permissions/add_submissions/',
        '/api/v2/permissions/discover_asset/',
        '/api/v2/permissions/view_submissions/',
        '/api/v2/permissions/change_asset/',
        '/api/v2/permissions/view_asset/',
        '/api/v2/permissions/change_submissions/',
      ],
      contradictory: [],
      name: 'Can manage all aspects of asset',
    },
    {
      url: '/api/v2/permissions/partial_submissions/',
      codename: 'partial_submissions',
      implied: ['/api/v2/permissions/view_asset/'],
      contradictory: [
        '/api/v2/permissions/view_submissions/',
        '/api/v2/permissions/change_submissions/',
        '/api/v2/permissions/delete_submissions/',
        '/api/v2/permissions/validate_submissions/',
        '/api/v2/permissions/manage_asset/',
      ],
      name: 'Can make partial actions on submitted data for asset for specific users',
    },
    {
      url: '/api/v2/permissions/validate_submissions/',
      codename: 'validate_submissions',
      implied: ['/api/v2/permissions/view_asset/', '/api/v2/permissions/view_submissions/'],
      contradictory: ['/api/v2/permissions/partial_submissions/'],
      name: 'Can validate submitted data asset',
    },
    {
      url: '/api/v2/permissions/view_asset/',
      codename: 'view_asset',
      implied: [],
      contradictory: [],
      name: 'Can view asset',
    },
    {
      url: '/api/v2/permissions/view_submissions/',
      codename: 'view_submissions',
      implied: ['/api/v2/permissions/view_asset/'],
      contradictory: ['/api/v2/permissions/partial_submissions/'],
      name: 'Can view submitted data for asset',
    },
  ],
}

// /api/v2/assets/<uid>/permission-assignments/
const assetWithAnonymousUser: PaginatedResponse<PermissionResponse> = {
  count: 7,
  next: null,
  previous: null,
  results: [
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pTi9qyEax49ZA5RP9KnNHB/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pATUgtDW6v44QG4dDDpnEV/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/change_asset/',
      label: 'Change asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pUUcqTtQ6FgEDfHUiQbS24/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/change_submissions/',
      label: 'Change submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/p5BjfEz9JDQtQTzkT7fHA5/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/validate_submissions/',
      label: 'Validate submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pBjfyz5Zxj95866GtEtsR2/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pQGiudmuLvN6iHEdH8dJAs/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/view_submissions/',
      label: 'View submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pV9kCoWAQT9QUeV2EsTLqj/',
      user: '/api/v2/users/AnonymousUser/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View asset',
    },
  ],
}

// /api/v2/assets/<uid>/permission-assignments/
const assetWithMultipleUsers: PaginatedResponse<PermissionResponse> = {
  count: 9,
  next: null,
  previous: null,
  results: [
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pTi9qyEax49ZA5RP9KnNHB/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pATUgtDW6v44QG4dDDpnEV/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/change_asset/',
      label: 'Change asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pUUcqTtQ6FgEDfHUiQbS24/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/change_submissions/',
      label: 'Change submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/p5BjfEz9JDQtQTzkT7fHA5/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/validate_submissions/',
      label: 'Validate submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pBjfyz5Zxj95866GtEtsR2/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pQGiudmuLvN6iHEdH8dJAs/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/view_submissions/',
      label: 'View submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pnld7XQ1hWYJ5sOUDl4qP/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/delete_submissions/',
      label: 'Delete submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pETvxGayAJwvPaCnt5biVD/',
      user: '/api/v2/users/olivier/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/p6KekjhZabd7ao9MBQwN7X/',
      user: '/api/v2/users/john/',
      permission: '/api/v2/permissions/view_submissions/',
      label: 'View submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pxp7BPnP9fohF5ZoH5Uwfa/',
      user: '/api/v2/users/john/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View asset',
    },
  ],
}

// /api/v2/assets/<uid>/permission-assignments/
const assetWithPartial: PaginatedResponse<PermissionResponse> = {
  count: 8,
  next: null,
  previous: null,
  results: [
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pTi9qyEax49ZA5RP9KnNHB/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pATUgtDW6v44QG4dDDpnEV/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/change_asset/',
      label: 'Change asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pUUcqTtQ6FgEDfHUiQbS24/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/change_submissions/',
      label: 'Change submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/p5BjfEz9JDQtQTzkT7fHA5/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/validate_submissions/',
      label: 'Validate submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pBjfyz5Zxj95866GtEtsR2/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pQGiudmuLvN6iHEdH8dJAs/',
      user: '/api/v2/users/kobo/',
      permission: '/api/v2/permissions/view_submissions/',
      label: 'View submissions',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/p6KekjhZabd7ao9MBQwN7X/',
      user: '/api/v2/users/leszek/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View asset',
    },
    {
      url: '/api/v2/assets/arMB2dNgwewktv954wmo9e/permission-assignments/pxp7BPnP9fohF5ZoH5Uwfa/',
      user: '/api/v2/users/leszek/',
      permission: '/api/v2/permissions/partial_submissions/',
      label: 'Partial submissions',
      partial_permissions: [
        {
          url: '/api/v2/permissions/view_submissions/',
          filters: [{ _submitted_by: { $in: ['john', 'olivier'] } }],
        },
        {
          url: '/api/v2/permissions/change_submissions/',
          filters: [{ Where_are_you_from: 'Poland' }],
        },
      ],
    },
  ],
}

// /api/v2/assets/<uid>/permission-assignments/
const assetWithMultiplePartial: PaginatedResponse<PermissionResponse> = {
  count: 3,
  next: null,
  previous: null,
  results: [
    {
      url: '/api/v2/assets/abc123/permission-assignments/asd123/',
      user: '/api/v2/users/gwyneth/',
      permission: '/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: '/api/v2/assets/abc123/permission-assignments/vbn123/',
      user: '/api/v2/users/gwyneth/',
      permission: '/api/v2/permissions/partial_submissions/',
      partial_permissions: [
        // This permission is the AND one, which is the only case supported by
        // Front-end code
        {
          url: '/api/v2/permissions/view_submissions/',
          filters: [
            {
              Where_are_you_from: 'Poland',
              _submitted_by: { $in: ['dave', 'krzysztof'] },
            },
          ],
        },
        {
          url: '/api/v2/permissions/change_submissions/',
          filters: [{ Your_color: 'blue' }],
        },
        {
          url: '/api/v2/permissions/delete_submissions/',
          // This is an alternative way of getting list of two users that sometimes we receive from BE
          filters: [{ _submitted_by: 'kate' }, { _submitted_by: 'joshua' }],
        },
        // This permission is the OR one, which is not supported by Front-end
        // code and should be treated as AND
        {
          url: '/api/v2/permissions/validate_submissions/',
          filters: [{ What_is_your_fav_animal: 'Racoon' }, { _submitted_by: 'zachary' }],
        },
      ],
      label: {
        default: 'Act on submissions only from specific users',
        view_submissions: 'View submissions only from specific users',
        change_submissions: 'Edit submissions only from specific users',
        delete_submissions: 'Delete submissions only from specific users',
        validate_submissions: 'Validate submissions only from specific users',
      },
    },
    {
      url: '/api/v2/assets/abc123/permission-assignments/zxc123/',
      user: '/api/v2/users/gwyneth/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View form',
    },
  ],
}

export const assetWithMultiplePartial2: PaginatedResponse<PermissionResponse> = {
  count: 3,
  next: null,
  previous: null,
  results: [
    {
      url: '/api/v2/assets/aqKcKVFdBVASFVo8azcdVp/permission-assignments/pSCPox6uspwYqroYvE7eXR/',
      user: '/api/v2/users/kate/',
      permission: '/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: '/api/v2/assets/aqKcKVFdBVASFVo8azcdVp/permission-assignments/p653D7wz6zXYuRBtpPpTGB/',
      user: '/api/v2/users/kate/',
      permission: '/api/v2/permissions/partial_submissions/',
      partial_permissions: [
        {
          url: '/api/v2/permissions/add_submissions/',
          filters: [
            {
              _submitted_by: 'bob',
            },
          ],
        },
        {
          url: '/api/v2/permissions/view_submissions/',
          filters: [
            {
              _submitted_by: 'bob',
            },
          ],
        },
        {
          url: '/api/v2/permissions/change_submissions/',
          filters: [
            {
              _submitted_by: 'bob',
            },
          ],
        },
        {
          url: '/api/v2/permissions/delete_submissions/',
          filters: [
            {
              _submitted_by: 'bob',
            },
          ],
        },
        {
          url: '/api/v2/permissions/validate_submissions/',
          filters: [
            {
              _submitted_by: 'bob',
            },
          ],
        },
      ],
      label: {
        default: 'Act on submissions only from specific users',
        view_submissions: 'View submissions only from specific users',
        change_submissions: 'Edit submissions only from specific users',
        delete_submissions: 'Delete submissions only from specific users',
        validate_submissions: 'Validate submissions only from specific users',
      },
    },
    {
      url: '/api/v2/assets/aqKcKVFdBVASFVo8azcdVp/permission-assignments/phRMBc7b2uxrVEspoJRxXN/',
      user: '/api/v2/users/kate/',
      permission: '/api/v2/permissions/view_asset/',
      label: 'View form',
    },
  ],
}

// This is the `buildFormData` output for user "kate"
export const assetWithMultiplePartial2_formData_kate: PermsFormDataPartialWithUsername = {
  username: 'kate',
  submissionsAdd: true,
  // Note: This is nonexistent in the output, because these are implied permissions and in current UI we don't show them
  // submissionsViewPartialByUsers: true,
  // submissionsViewPartialByUsersList: ['bob'],
  submissionsDeletePartialByUsers: true,
  submissionsDeletePartialByUsersList: ['bob'],
  submissionsEditPartialByUsers: true,
  submissionsEditPartialByUsersList: ['bob'],
  submissionsValidatePartialByUsers: true,
  submissionsValidatePartialByUsersList: ['bob'],
}

export const endpoints = {
  permissions,
  assetWithAnonymousUser,
  assetWithMultipleUsers,
  assetWithPartial,
  assetWithMultiplePartial,
}
