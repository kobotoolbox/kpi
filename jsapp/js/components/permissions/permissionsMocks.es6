/**
* Mock permissions endpoints responses for tests.
*/

// /api/v2/permissions/
const permissions = {
  'count': 9,
  'next': null,
  'previous': null,
  'results': [
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/add_submissions/',
      'codename': 'add_submissions',
      'implied': [
        'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
      ],
      'contradictory': [],
      'name': '',
      'description': 'Can submit data to asset'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/change_asset/',
      'codename': 'change_asset',
      'implied': [
        'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
      ],
      'contradictory': [],
      'name': '',
      'description': 'Can change asset'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/change_submissions/',
      'codename': 'change_submissions',
      'implied': [
        'http://kf.kobo.local:90/api/v2/permissions/view_asset/',
        'http://kf.kobo.local:90/api/v2/permissions/view_submissions/'
      ],
      'contradictory': [
        'http://kf.kobo.local:90/api/v2/permissions/partial_submissions/'
      ],
      'name': '',
      'description': 'Can modify submitted data for asset'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/partial_submissions/',
      'codename': 'partial_submissions',
      'implied': [
        'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
      ],
      'contradictory': [
        'http://kf.kobo.local:90/api/v2/permissions/view_submissions/',
        'http://kf.kobo.local:90/api/v2/permissions/change_submissions/',
        'http://kf.kobo.local:90/api/v2/permissions/validate_submissions/'
      ],
      'name': '',
      'description': 'Can make partial actions onsubmitted data for asset for specific users'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/validate_submissions/',
      'codename': 'validate_submissions',
      'implied': [
        'http://kf.kobo.local:90/api/v2/permissions/view_asset/',
        'http://kf.kobo.local:90/api/v2/permissions/view_submissions/'
      ],
      'contradictory': [
        'http://kf.kobo.local:90/api/v2/permissions/partial_submissions/'
      ],
      'name': '',
      'description': 'Can validate submitted data asset'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/view_asset/',
      'codename': 'view_asset',
      'implied': [],
      'contradictory': [],
      'name': '',
      'description': 'Can view asset'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/view_submissions/',
      'codename': 'view_submissions',
      'implied': [
        'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
      ],
      'contradictory': [
        'http://kf.kobo.local:90/api/v2/permissions/partial_submissions/'
      ],
      'name': '',
      'description': 'Can view submitted data for asset'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/change_collection/',
      'codename': 'change_collection',
      'implied': [
        'http://kf.kobo.local:90/api/v2/permissions/view_collection/'
      ],
      'contradictory': [],
      'name': '',
      'description': 'Can change collection'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/permissions/view_collection/',
      'codename': 'view_collection',
      'implied': [],
      'contradictory': [],
      'name': '',
      'description': 'Can view collection'
    }
  ]
};

// /api/v2/assets/<uid>/permissions/
const assetWithAnonymousUser = {
  'count': 7,
  'next': null,
  'previous': null,
  'results': [
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pTi9qyEax49ZA5RP9KnNHB/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/add_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pATUgtDW6v44QG4dDDpnEV/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/change_asset/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pUUcqTtQ6FgEDfHUiQbS24/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/change_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/p5BjfEz9JDQtQTzkT7fHA5/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/validate_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pBjfyz5Zxj95866GtEtsR2/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pQGiudmuLvN6iHEdH8dJAs/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pV9kCoWAQT9QUeV2EsTLqj/',
      'user': 'http://kf.kobo.local:90/api/v2/users/AnonymousUser/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
    }
  ]
};

// /api/v2/assets/<uid>/permissions/
const assetWithMultipleUsers = {
  'count': 9,
  'next': null,
  'previous': null,
  'results': [
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pTi9qyEax49ZA5RP9KnNHB/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/add_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pATUgtDW6v44QG4dDDpnEV/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/change_asset/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pUUcqTtQ6FgEDfHUiQbS24/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/change_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/p5BjfEz9JDQtQTzkT7fHA5/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/validate_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pBjfyz5Zxj95866GtEtsR2/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pQGiudmuLvN6iHEdH8dJAs/',
      'user': 'http://kf.kobo.local:90/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pETvxGayAJwvPaCnt5biVD/',
      'user': 'http://kf.kobo.local:90/api/v2/users/oliver/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/p6KekjhZabd7ao9MBQwN7X/',
      'user': 'http://kf.kobo.local:90/api/v2/users/john/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_submissions/'
    },
    {
      'url': 'http://kf.kobo.local:90/api/v2/assets/arMB2dNgwewktv954wmo9e/permissions/pxp7BPnP9fohF5ZoH5Uwfa/',
      'user': 'http://kf.kobo.local:90/api/v2/users/john/',
      'permission': 'http://kf.kobo.local:90/api/v2/permissions/view_asset/'
    }
  ]
};

export default {
  permissions: permissions,
  assetWithAnon: assetWithAnonymousUser,
  assetWithMulti: assetWithMultipleUsers
};
