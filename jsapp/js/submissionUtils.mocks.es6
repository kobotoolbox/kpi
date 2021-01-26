export const simpleSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': '9PMXyB7Sv',
  '$autoname': 'start',
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'AkKyOYSIP',
  '$autoname': 'end',
}, {
  'type': 'text',
  '$kuid': 'uw4if17',
  'label': ['First name', 'Pierwsze imię'],
  'required': false,
  '$autoname': 'First_name',
}, {
  'name': 'group_favourites',
  'type': 'begin_group',
  '$kuid': 'fx8qb06',
  'label': ['Favourites', 'Ulubione'],
  '$autoname': 'group_favourites',
}, {
  'type': 'select_one',
  '$kuid': 'az1fc41',
  'label': ['Favourite color', 'Ulubiony kolor'],
  'required': false,
  '$autoname': 'Favourite_color',
  'select_from_list_name': 'fav_col_list',
}, {
  'type': 'integer',
  '$kuid': 'ka9pv41',
  'label': ['Favourite number', 'Ulubiona liczba'],
  'required': false,
  '$autoname': 'Favourite_number',
}, {
  'type': 'end_group',
  '$kuid': '/fx8qb06',
}];

export const simpleSurveyChoices = [{
  'name': 'pink',
  'label': ['Pink'],
  'list_name': 'fav_col_list',
}, {
  'name': 'blue',
  'label': ['Blue'],
  'list_name': 'fav_col_list',
}];

export const simpleSurveySubmission = {
  '__version__': 'vHNo5vFh3KoB7LWhucUkFy',
  '_attachments': [],
  '_bamboo_dataset_id': '',
  '_geolocation': [null, null],
  '_id': 16,
  '_notes': [],
  '_status': 'submitted_via_web',
  '_submission_time': '2020-04-06T11:11:47',
  '_submitted_by': null,
  '_tags': [],
  '_uuid': 'faa38eee-4e3f-419e-bac0-e95f1085d998',
  '_validation_status': {},
  '_xform_id_string': 'afKfAnPYX3X7kojqM2cJDb',
  'end': '2020-04-06T13:11:41.006+02:00',
  'First_name': 'Leszek',
  'formhub/uuid': '57e6fd0b4065443280c9641be5670e89',
  'group_favourites/Favourite_color': 'pink',
  'group_favourites/Favourite_number': '24',
  'meta/instanceID': 'uuid:faa38eee-4e3f-419e-bac0-e95f1085d998',
  'start': '2020-04-06T13:11:31.421+02:00',
};

export const simpleSurveySubmissionEmpty = {
  '__version__': 'vHNo5vFh3KoB7LWhucUkFy',
  '_attachments': [],
  '_bamboo_dataset_id': '',
  '_geolocation': [null, null],
  '_id': 18,
  '_notes': [],
  '_status': 'submitted_via_web',
  '_submission_time': '2020-04-08T08:46:47',
  '_submitted_by': null,
  '_tags': [],
  '_uuid': '69ff2e33-4d4b-4891-8c81-82d7316cf51f',
  '_validation_status': {},
  '_xform_id_string': 'afKfAnPYX3X7kojqM2cJDb',
  'end': '2020-04-08T10:46:41.882+02:00',
  'formhub/uuid': '57e6fd0b4065443280c9641be5670e89',
  'group_favourites/Favourite_number': '5',
  'meta/instanceID': 'uuid:69ff2e33-4d4b-4891-8c81-82d7316cf51f',
  'start': '2020-04-08T10:46:34.957+02:00',
};

export const simpleSurveyDisplayData = [
  {
    type: 'text',
    label: 'Pierwsze imię',
    name: 'First_name',
    data: 'Leszek',
  },
  {
    type: 'group_regular',
    label: 'Ulubione',
    name: 'group_favourites',
    children: [
      {
        type: 'select_one',
        label: 'Ulubiony kolor',
        name: 'Favourite_color',
        listName: 'fav_col_list',
        data: 'pink',
      },
      {
        type: 'integer',
        label: 'Ulubiona liczba',
        name: 'Favourite_number',
        data: '24',
      },
    ],
  },
];

export const simpleSurveyDisplayDataEmpty = [
  {
    type: 'text',
    label: 'First name',
    name: 'First_name',
    data: null,
  },
  {
    type: 'group_regular',
    label: 'Favourites',
    name: 'group_favourites',
    children: [
      {
        type: 'select_one',
        label: 'Favourite color',
        name: 'Favourite_color',
        listName: 'fav_col_list',
        data: null,
      },
      {
        type: 'integer',
        label: 'Favourite number',
        name: 'Favourite_number',
        data: '5',
      },
    ],
  },
];

export const repeatSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'lMV6oqDcf',
  '$autoname': 'start',
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'sdwqjbndr',
  '$autoname': 'end',
}, {
  'name': 'group_members',
  'type': 'begin_repeat',
  '$kuid': 'fd8yo77',
  'label': ['Members'],
  'required': false,
  '$autoname': 'group_members',
}, {
  'type': 'text',
  '$kuid': 'lm2ww64',
  'label': ['First name'],
  'required': false,
  '$autoname': 'First_name',
}, {
  'type': 'text',
  '$kuid': 'nf9gq14',
  'label': ['Middle name'],
  'required': false,
  '$autoname': 'Middle_name',
}, {
  'type': 'text',
  '$kuid': 'qt6mr31',
  'label': ['Last name'],
  'required': false,
  '$autoname': 'Last_name',
}, {
  'type': 'end_repeat',
  '$kuid': '/fd8yo77',
}];

// NOTE: the second repeat submission has no First_name and Middle_name to test stuff better
export const repeatSurveySubmission = {
  '_id': 17,
  '_notes': [],
  '__version__': 'v8khdgcT3SYb2HRJhMNtsE',
  '_attachments': [],
  '_bamboo_dataset_id': '',
  '_geolocation': [null, null],
  '_status': 'submitted_via_web',
  '_submission_time': '2020-04-07T14:07:48',
  '_submitted_by': null,
  '_tags': [],
  '_uuid': '651137b9-e465-49ed-9924-a67d7b1c6f76',
  '_validation_status': {},
  '_xform_id_string': 'afmcL74BTjjRpdAJy52WGX',
  'end': '2020-04-07T16:07:41.931+02:00',
  'formhub/uuid': 'b26f2a9b9b7a49608920ad76cba3c315',
  'group_members': [{
    'group_members/First_name': 'Leszek',
    'group_members/Middle_name': 'Jan',
    'group_members/Last_name': 'Pietrzak',
  }, {
    'group_members/Last_name': 'Niepietrzak',
  }],
  'meta/instanceID': 'uuid:651137b9-e465-49ed-9924-a67d7b1c6f76',
  'start': '2020-04-07T16:07:24.044+02:00',
};

export const repeatSurveyDisplayData = [
  {
    type: 'group_repeat',
    label: 'Members',
    name: 'group_members',
    children: [
      {
        type: 'text',
        label: 'First name',
        name: 'First_name',
        data: 'Leszek',
      },
      {
        type: 'text',
        label: 'Middle name',
        name: 'Middle_name',
        data: 'Jan',
      },
      {
        type: 'text',
        label: 'Last name',
        name: 'Last_name',
        data: 'Pietrzak',
      },
    ],
  },
  {
    type: 'group_repeat',
    label: 'Members',
    name: 'group_members',
    children: [
      {
        type: 'text',
        label: 'First name',
        name: 'First_name',
        data: null,
      },
      {
        type: 'text',
        label: 'Middle name',
        name: 'Middle_name',
        data: null,
      },
      {
        type: 'text',
        label: 'Last name',
        name: 'Last_name',
        data: 'Niepietrzak',
      },
    ],
  },
];

export const nestedRepeatSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'Rq36zKyog',
  '$autoname': 'start',
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'Redw9OtxY',
  '$autoname': 'end',
}, {
  'type': 'begin_repeat',
  'label': ['People'],
  'name': 'group_people',
  '$kuid': 'aj45t09',
  '$autoname': 'group_people',
}, {
  'type': 'text',
  'label': ['Name'],
  'required': false,
  '$kuid': 'bj78z02',
  '$autoname': 'Name',
}, {
  'type': 'begin_repeat',
  'label': ['Personal items'],
  'name': 'group_items',
  '$kuid': 'te04d01',
  '$autoname': 'group_items',
}, {
  'type': 'text',
  'label': ['Item name'],
  'required': false,
  '$kuid': 'fd1ec62',
  '$autoname': 'Item_name',
}, {
  'type': 'end_repeat',
  '$kuid': '/te04d01',
}, {
  'type': 'end_repeat',
  '$kuid': '/aj45t09',
}];

export const nestedRepeatSurveySubmission = {
  '__version__': 'v7sPQZCGQoW8JKYL5Kq79m',
  '_attachments': [],
  '_bamboo_dataset_id': '',
  '_geolocation': [null, null],
  '_id': 20,
  '_notes': [],
  '_status': 'submitted_via_web',
  '_submission_time': '2020-04-08T11:12:20',
  '_submitted_by': null,
  '_tags': [],
  '_uuid': '83aa0573-8a44-42f7-885b-aa7a3afffbd1',
  '_validation_status': {},
  '_xform_id_string': 'ahTnpQwdqrrp4fRKqUxj2p',
  'end': '2020-04-08T13:22:56.270+02:00',
  'formhub/uuid': 'd6123d44cf8c4fa78e38556b5af6bd68',
  'group_people': [{
    'group_people/group_items': [{
      'group_people/group_items/Item_name': 'Notebook',
    }, {
      'group_people/group_items/Item_name': 'Pen',
    }, {
      'group_people/group_items/Item_name': 'Shoe',
    }],
    'group_people/Name': 'John',
  }, {
    'group_people/Name': 'Leszek',
  }, {
    'group_people/group_items': [{
      'group_people/group_items/Item_name': 'Computer',
    }],
  }],
  'meta/deprecatedID': 'uuid:85397438-558e-4b24-94d7-901550744352',
  'meta/instanceID': 'uuid:83aa0573-8a44-42f7-885b-aa7a3afffbd1',
  'start': '2020-04-08T13:11:29.840+02:00',
};

export const nestedRepeatSurveyDisplayData = [
  {
    type: 'group_repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'text',
        label: 'Name',
        name: 'Name',
        data: 'John',
      },
      {
        type: 'group_repeat',
        label: 'Personal items',
        name: 'group_items',
        children: [
          {
            type: 'text',
            label: 'Item name',
            name: 'Item_name',
            data: 'Notebook',
          },
        ],
      },
      {
        type: 'group_repeat',
        label: 'Personal items',
        name: 'group_items',
        children: [
          {
            type: 'text',
            label: 'Item name',
            name: 'Item_name',
            data: 'Pen',
          },
        ],
      },
      {
        type: 'group_repeat',
        label: 'Personal items',
        name: 'group_items',
        children: [
          {
            type: 'text',
            label: 'Item name',
            name: 'Item_name',
            data: 'Shoe',
          },
        ],
      },
    ],
  },
  {
    type: 'group_repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'text',
        label: 'Name',
        name: 'Name',
        data: 'Leszek',
      },
    ],
  },
  {
    type: 'group_repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'text',
        label: 'Name',
        name: 'Name',
        data: null,
      },
      {
        type: 'group_repeat',
        label: 'Personal items',
        name: 'group_items',
        children: [
          {
            type: 'text',
            label: 'Item name',
            name: 'Item_name',
            data: 'Computer',
          },
        ],
      },
    ],
  },
];

export const matrixSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'HVwODOAEK',
  '$autoname': 'start',
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': '32gE3g5ST',
  '$autoname': 'end',
}, {
  'name': 'today',
  'type': 'today',
  '$kuid': '3h9Nl2bpx',
  '$autoname': 'today',
}, {
  'name': 'username',
  'type': 'username',
  '$kuid': '3RscqJRor',
  '$autoname': 'username',
}, {
  'name': 'simserial',
  'type': 'simserial',
  '$kuid': 'ozNn7JwMd',
  '$autoname': 'simserial',
}, {
  'name': 'subscriberid',
  'type': 'subscriberid',
  '$kuid': 'tStWXbDyQ',
  '$autoname': 'subscriberid',
}, {
  'name': 'deviceid',
  'type': 'deviceid',
  '$kuid': 'll7GCh9oi',
  '$autoname': 'deviceid',
}, {
  'name': 'phonenumber',
  'type': 'phonenumber',
  '$kuid': 'b02UNLdMV',
  '$autoname': 'phonenumber',
}, {
  'name': 'countries',
  'type': 'begin_kobomatrix',
  '$kuid': 'en5ri38',
  'label': ['Countries'],
  'required': false,
  '$autoname': 'countries',
  '_isRepeat': 'false',
  'appearance': 'field-list',
  'kobo--matrix_list': 'count_ch_list',
}, {
  'hint': [''],
  'name': 'ecology_level',
  'type': 'integer',
  '$kuid': 'mi7ka64',
  'label': ['Ecology level'],
  'required': false,
  '$autoname': 'ecology_level',
  'appearance': 'w1',
}, {
  'hint': [''],
  'name': 'secularity_level',
  'type': 'integer',
  '$kuid': 'iy4fw00',
  'label': ['Secularity level'],
  'required': false,
  '$autoname': 'secularity_level',
  'appearance': 'w1',
}, {
  'type': 'end_kobomatrix',
  '$kuid': '/en5ri38',
}];

export const matrixSurveyChoices = [{
  'name': 'poland',
  '$kuid': 'wa9kl23',
  'label': ['Poland'],
  'list_name': 'count_ch_list',
  '$autovalue': 'poland',
}];

export const matrixSurveySubmission = {
  '_id': 22,
  'username': 'username not found',
  'simserial': 'simserial not found',
  '_validation_status': {},
  '_uuid': 'a0039b58-1b2d-4445-912e-01e4ad56dbb4',
  '_bamboo_dataset_id': '',
  '_tags': [],
  '_submitted_by': null,
  'countries_poland/countries_poland_ecology_level': '3',
  '_xform_id_string': 'aikoAHFLnmPw6WwQJCb8x3',
  'meta/instanceID': 'uuid:a0039b58-1b2d-4445-912e-01e4ad56dbb4',
  'formhub/uuid': 'f081027d597142b9a17a7a3bb3a5aff1',
  'end': '2020-04-20T18:00:05.384+02:00',
  '_submission_time': '2020-04-20T16:00:10',
  '_notes': [],
  '_attachments': [],
  'start': '2020-04-20T17:59:54.295+02:00',
  'countries_poland/countries_poland_secularity_level': '-5',
  '_geolocation': [null, null],
  'deviceid': 'ee.kobo.local:4l56OZ7GLLixoZ9J',
  'phonenumber': 'phonenumber not found',
  '_status': 'submitted_via_web',
  '__version__': 'vPNH6GBsRjMKLfXrisReYA',
  'subscriberid': 'subscriberid not found',
  'today': '2020-04-20',
};

export const matrixSurveyDisplayData = [
  {
    type: 'group_matrix',
    label: 'Countries',
    name: 'countries',
    children: [
      {
        type: 'group_matrix_row',
        label: 'Poland',
        name: 'poland',
        children: [
          {
            type: 'integer',
            label: 'Ecology level',
            name: 'ecology_level',
            data: '3',
          },
          {
            type: 'integer',
            label: 'Secularity level',
            name: 'secularity_level',
            data: '-5',
          },
        ],
      },
    ],
  },
];

export const groupsSurvey = [{
  'name': 'group_people',
  'type': 'begin_repeat',
  '$kuid': 'fs1km00',
  'label': ['People'],
  '$autoname': 'group_people',
}, {
  'type': 'text',
  '$kuid': 'sr97c95',
  'label': ['First name'],
  'required': false,
  '$autoname': 'First_name',
}, {
  'type': 'end_repeat',
  '$kuid': '/fs1km00',
}, {
  'name': 'group_location',
  'type': 'begin_group',
  '$kuid': 'lq0th66',
  'label': ['Location'],
  '$autoname': 'group_location',
}, {
  'type': 'geopoint',
  '$kuid': 'ug36q69',
  'label': ['Original location'],
  'required': false,
  '$autoname': 'Original_location',
}, {
  'type': 'geopoint',
  '$kuid': 'kw6zd49',
  'label': ['Current location'],
  'required': false,
  '$autoname': 'Current_location',
}, {
  'type': 'end_group',
  '$kuid': '/lq0th66',
}, {
  'type': 'begin_score',
  '$kuid': 'rd0zi80',
  'label': ['Are you vegan?'],
  'required': false,
  '$autoname': 'Are_you_vegan',
  'kobo--score-choices': 'vg_ch_list',
}, {
  'type': 'score__row',
  '$kuid': 'as5gb66',
  'label': ['Killing humans'],
  '$autoname': 'Killing_humans',
}, {
  'type': 'score__row',
  '$kuid': 'kv3uq84',
  'label': ['Killing nonhumans'],
  '$autoname': 'Killing_nonhumans',
}, {
  'type': 'end_score',
  '$kuid': '/rd0zi80',
}, {
  'type': 'begin_rank',
  '$kuid': 'bj3zo95',
  'label': ['Best things in life'],
  'required': false,
  '$autoname': 'Best_things_in_life',
  'kobo--rank-items': 'best_ch_list',
  'kobo--rank-constraint-message': 'Items cannot be selected more than once',
}, {
  'type': 'rank__level',
  '$kuid': 'yy8lt23',
  'label': ['1st choice'],
  '$autoname': '_1st_choice',
}, {
  'type': 'rank__level',
  '$kuid': 'll0ky89',
  'label': ['2nd choice'],
  '$autoname': '_2nd_choice',
}, {
  'type': 'rank__level',
  '$kuid': 'cz6uz72',
  'label': ['3rd choice'],
  '$autoname': '_3rd_choice',
}, {
  'type': 'end_rank',
  '$kuid': '/bj3zo95',
}, {
  'name': 'group_crossbreeding',
  'type': 'begin_kobomatrix',
  '$kuid': 'vs75w20',
  'label': ['Crossbreeding'],
  '$autoname': 'group_crossbreeding',
  '_isRepeat': 'false',
  'appearance': 'field-list',
  'kobo--matrix_list': 'crossbr_ch_list',
}, {
  'hint': [''],
  'name': 'human',
  'type': 'text',
  '$kuid': 'ji8zj93',
  'label': ['Human'],
  'required': false,
  '$autoname': 'human',
  'appearance': 'w1',
}, {
  'hint': [''],
  'name': 'nonhuman',
  'type': 'text',
  '$kuid': 'on6ec28',
  'label': ['Nonhuman'],
  'required': false,
  '$autoname': 'nonhuman',
  'appearance': 'w1',
}, {
  'type': 'end_kobomatrix',
  '$kuid': '/vs75w20',
}];

export const groupsSurveyChoices = [{
  'name': 'good',
  '$kuid': '4g11EC3jB',
  'label': ['Good'],
  'list_name': 'vg_ch_list',
  '$autovalue': 'good',
}, {
  'name': 'bad',
  '$kuid': 'iWSKBTsBL',
  'label': ['Bad'],
  'list_name': 'vg_ch_list',
  '$autovalue': 'bad',
}, {
  'name': 'food',
  '$kuid': 'gZdFOT2Au',
  'label': ['Food'],
  'list_name': 'best_ch_list',
  '$autovalue': 'food',
}, {
  'name': 'sleep',
  '$kuid': '29qNZUz3S',
  'label': ['Sleep'],
  'list_name': 'best_ch_list',
  '$autovalue': 'sleep',
}, {
  'name': 'conquest',
  '$kuid': 'U0A1jTOH9',
  'label': ['Conquest'],
  'list_name': 'best_ch_list',
  '$autovalue': 'conquest',
}, {
  'name': 'fire',
  '$kuid': 'dl9lc82',
  'label': ['Fire'],
  'list_name': 'crossbr_ch_list',
  '$autovalue': 'fire',
}, {
  'name': 'water',
  '$kuid': 'qn03v13',
  'label': ['Water'],
  'list_name': 'crossbr_ch_list',
  '$autovalue': 'water',
}];

export const groupsSurveySubmission = {
  '_id': 23,
  'Are_you_vegan/Killing_humans': 'good',
  '_validation_status': {},
  '_uuid': '846a669e-299e-4650-bdfa-05bcf34622e2',
  '_bamboo_dataset_id': '',
  '_tags': [],
  'Best_things_in_life/_2nd_choice': 'sleep',
  '_submitted_by': null,
  'Are_you_vegan/Killing_nonhumans': 'bad',
  '_xform_id_string': 'aP87YegB993rHGjAaihyte',
  'Best_things_in_life/_1st_choice': 'conquest',
  'meta/instanceID': 'uuid:846a669e-299e-4650-bdfa-05bcf34622e2',
  'group_crossbreeding_water/group_crossbreeding_water_nonhuman': 'waterthing',
  'formhub/uuid': 'f558c8ebd7ba410194b84503ea6ca865',
  'group_crossbreeding_water/group_crossbreeding_water_human': 'waterman',
  'group_location/Current_location': '53.748711 -7.880555 0 0',
  'group_people': [{
    'group_people/First_name': 'Leszek',
  }, {
    'group_people/First_name': 'John',
  }],
  '_submission_time': '2020-04-23T18:16:08',
  '_notes': [],
  '_attachments': [],
  'group_crossbreeding_fire/group_crossbreeding_fire_nonhuman': 'firething',
  'group_crossbreeding_fire/group_crossbreeding_fire_human': 'fireman',
  'group_location/Original_location': '52.48278 18.813458 0 0',
  'Best_things_in_life/_3rd_choice': 'food',
  '_status': 'submitted_via_web',
  '__version__': 'vN4myUe5KyYrGN4dGrpBid',
  'today': '2020-04-23',
};

export const groupsSurveyDisplayData = [
  {
    type: 'group_repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'text',
        label: 'First name',
        name: 'First_name',
        data: 'Leszek',
      },
    ],
  },
  {
    type: 'group_repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'text',
        label: 'First name',
        name: 'First_name',
        data: 'John',
      },
    ],
  },
  {
    type: 'group_regular',
    label: 'Location',
    name: 'group_location',
    children: [
      {
        'type': 'geopoint',
        'label': 'Original location',
        'name': 'Original_location',
        'data': '52.48278 18.813458 0 0',
      },
      {
        'type': 'geopoint',
        'label': 'Current location',
        'name': 'Current_location',
        'data': '53.748711 -7.880555 0 0',
      },
    ],
  },
  {
    type: 'group_regular',
    label: 'Are you vegan?',
    name: 'Are_you_vegan',
    children: [
      {
        'type': 'score__row',
        'label': 'Killing humans',
        'name': 'Killing_humans',
        'listName': 'vg_ch_list',
        'data': 'good',
      },
      {
        'type': 'score__row',
        'label': 'Killing nonhumans',
        'name': 'Killing_nonhumans',
        'listName': 'vg_ch_list',
        'data': 'bad',
      },
    ],
  },
  {
    type: 'group_regular',
    label: 'Best things in life',
    name: 'Best_things_in_life',
    children: [
      {
        'type': 'rank__level',
        'label': '1st choice',
        'name': '_1st_choice',
        'listName': 'best_ch_list',
        'data': 'conquest',
      },
      {
        'type': 'rank__level',
        'label': '2nd choice',
        'name': '_2nd_choice',
        'listName': 'best_ch_list',
        'data': 'sleep',
      },
      {
        'type': 'rank__level',
        'label': '3rd choice',
        'name': '_3rd_choice',
        'listName': 'best_ch_list',
        'data': 'food',
      },
    ],
  },
  {
    type: 'group_matrix',
    label: 'Crossbreeding',
    name: 'group_crossbreeding',
    children: [
      {
        type: 'group_matrix_row',
        label: 'Fire',
        name: 'fire',
        children: [
          {
            type: 'text',
            label: 'Human',
            name: 'human',
            data: 'fireman',
          },
          {
            type: 'text',
            label: 'Nonhuman',
            name: 'nonhuman',
            data: 'firething',
          },
        ],
      },
      {
        type: 'group_matrix_row',
        label: 'Water',
        name: 'water',
        children: [
          {
            type: 'text',
            label: 'Human',
            name: 'human',
            data: 'waterman',
          },
          {
            type: 'text',
            label: 'Nonhuman',
            name: 'nonhuman',
            data: 'waterthing',
          },
        ],
      },
    ],
  },
];

export const everythingSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'hI2IjAPLy',
  '$autoname': 'start',
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'xVomX5yES',
  '$autoname': 'end',
}, {
  'type': 'select_one',
  '$kuid': 'ys1bd14',
  'label': ['Favourite country'],
  'required': false,
  '$autoname': 'Favourite_country',
  'select_from_list_name': 'fav_cntr_list',
}, {
  'type': 'select_multiple',
  '$kuid': 'ca8bv64',
  'label': ['Favourite food'],
  'required': false,
  '$autoname': 'Favourite_food',
  'select_from_list_name': 'fav_food_ch_list',
}, {
  'type': 'text',
  '$kuid': 'gr1hn65',
  'label': ['Your name'],
  'required': false,
  '$autoname': 'Your_name',
}, {
  'type': 'integer',
  '$kuid': 'vw1ya03',
  'label': ['Lucky number'],
  'required': false,
  '$autoname': 'Lucky_number',
}, {
  'type': 'decimal',
  '$kuid': 'ia1ux31',
  'label': ['Unlucky number'],
  'required': false,
  '$autoname': 'Unlucky_number',
}, {
  'type': 'date',
  '$kuid': 'vl8ck72',
  'label': ['Birth date'],
  'required': false,
  '$autoname': 'Birth_date',
}, {
  'type': 'time',
  '$kuid': 'qa9pv52',
  'label': ['Birth time'],
  'required': false,
  '$autoname': 'Birth_time',
}, {
  'type': 'datetime',
  '$kuid': 'cq0yk16',
  'label': ['Some random date and time'],
  'required': false,
  '$autoname': 'Some_random_date_and_time',
}, {
  'type': 'geopoint',
  '$kuid': 'ib3wx74',
  'label': ['Secret spot'],
  'required': false,
  '$autoname': 'Secret_spot',
}, {
  'type': 'image',
  '$kuid': 'vu9cb06',
  'label': ['Selfportrait'],
  'required': false,
  '$autoname': 'Selfportrait',
  'parameters': 'max-pixels=1024',
}, {
  'type': 'audio',
  '$kuid': 'aa28j83',
  'label': ['Voice password'],
  'required': false,
  '$autoname': 'Voice_password',
}, {
  'type': 'video',
  '$kuid': 'tj2xw94',
  'label': ['A video?'],
  'required': false,
  '$autoname': 'A_video',
}, {
  'type': 'geotrace',
  '$kuid': 'bh5yb78',
  'label': ['Shortest path'],
  'required': false,
  '$autoname': 'Shortest_path',
}, {
  'type': 'note',
  '$kuid': 'pg3yl90',
  'label': ['This is a secret'],
  'required': false,
  '$autoname': 'This_is_a_secret',
}, {
  'type': 'barcode',
  '$kuid': 'qu5zg17',
  'label': ['Favourite chocolate barcode'],
  'required': false,
  '$autoname': 'Favourite_chocolate_barcode',
}, {
  'type': 'acknowledge',
  '$kuid': 'ym87f54',
  'label': ['Are you sane?'],
  'required': false,
  '$autoname': 'Are_you_sane',
}, {
  'type': 'geoshape',
  '$kuid': 'ua1av57',
  'label': ['Secret area'],
  'required': false,
  '$autoname': 'Secret_area',
}, {
  'type': 'begin_score',
  '$kuid': 'yp8ep33',
  'label': ['How are you?'],
  'required': false,
  '$autoname': 'How_are_you',
  'kobo--score-choices': 'how_r_u_ch_list',
}, {
  'name': 'outside',
  'type': 'score__row',
  '$kuid': 'ir6tu76',
  'label': ['Outside'],
  'required': false,
  '$autoname': 'outside',
}, {
  'name': 'inside',
  'type': 'score__row',
  '$kuid': 'je4go60',
  'label': ['Inside'],
  'required': false,
  '$autoname': 'inside',
}, {
  'type': 'end_score',
  '$kuid': '/yp8ep33',
}, {
  'name': 'test_your_math',
  'type': 'begin_kobomatrix',
  '$kuid': 'gy07t52',
  'label': ['Test your math'],
  'required': false,
  '$autoname': 'test_your_math',
  '_isRepeat': 'false',
  'appearance': 'field-list',
  'kobo--matrix_list': 'matrix_cb3fk35',
}, {
  'hint': [''],
  'name': 'plus',
  'type': 'integer',
  '$kuid': 'oh83n52',
  'label': ['Plus'],
  'required': false,
  '$autoname': 'plus',
  'appearance': 'w1',
}, {
  'hint': [''],
  'name': 'minus',
  'type': 'select_one',
  '$kuid': 'gy9ev97',
  'label': ['Minus'],
  'required': false,
  '$autoname': 'minus',
  'appearance': 'w1',
  'select_from_list_name': 'min_ch_list',
}, {
  'type': 'end_kobomatrix',
  '$kuid': '/gy07t52',
}, {
  'type': 'begin_rank',
  '$kuid': 'vs3yt07',
  'label': ['Colours by brightness'],
  'required': false,
  '$autoname': 'Colours_by_brightness',
  'kobo--rank-items': 'col_br_ch_list',
  'kobo--rank-constraint-message': 'Items cannot be selected more than once',
}, {
  'type': 'rank__level',
  '$kuid': 'yp71p21',
  'label': ['1st choice'],
  'required': false,
  '$autoname': '_1st_choice',
}, {
  'type': 'rank__level',
  '$kuid': 'ac8ez34',
  'label': ['2nd choice'],
  'required': false,
  '$autoname': '_2nd_choice',
}, {
  'type': 'end_rank',
  '$kuid': '/vs3yt07',
}, {
  'type': 'file',
  '$kuid': 'dz9cv47',
  'label': ['We need your CV'],
  'required': false,
  '$autoname': 'We_need_your_CV',
  'body::accept': 'txt',
}, {
  'type': 'range',
  '$kuid': 'jb6ll34',
  'label': ['Expected lifespan'],
  'required': false,
  '$autoname': 'Expected_lifespan',
  'parameters': 'start=1;end=125;step=1',
}];

export const everythingSurveyChoices = [{
  'name': 'poland',
  '$kuid': 'dVHZ9VigU',
  'label': ['Poland'],
  'list_name': 'fav_cntr_list',
  '$autovalue': 'poland',
}, {
  'name': 'ireland',
  '$kuid': 'awQvU6AGY',
  'label': ['Ireland'],
  'list_name': 'fav_cntr_list',
  '$autovalue': 'ireland',
}, {
  'name': 'pizza',
  '$kuid': 'V5aeF2EbQ',
  'label': ['Pizza'],
  'list_name': 'fav_food_ch_list',
  '$autovalue': 'pizza',
}, {
  'name': 'apple',
  '$kuid': 'XjaJ0GAm0',
  'label': ['Apple'],
  'list_name': 'fav_food_ch_list',
  '$autovalue': 'apple',
}, {
  'name': 'good',
  '$kuid': 'YtKFyrtef',
  'label': ['Good'],
  'list_name': 'how_r_u_ch_list',
  '$autovalue': 'good',
}, {
  'name': 'bad',
  '$kuid': 'eVEUuBWFf',
  'label': ['Bad'],
  'list_name': 'how_r_u_ch_list',
  '$autovalue': 'bad',
}, {
  'name': 'yellow',
  '$kuid': 'DzPdmquZQ',
  'label': ['Yellow'],
  'list_name': 'col_br_ch_list',
  '$autovalue': 'yellow',
}, {
  'name': 'blue',
  '$kuid': '6oHmUYz8S',
  'label': ['Blue'],
  'list_name': 'col_br_ch_list',
  '$autovalue': 'blue',
}, {
  'name': '2_and_4',
  '$kuid': 'bd6hu92',
  'label': ['2 and 4'],
  'list_name': 'matrix_cb3fk35',
  '$autovalue': '2_and_4',
}, {
  'name': 'minus_four',
  '$kuid': 'tq31o95',
  'label': ['-4'],
  'list_name': 'min_ch_list',
  '$autovalue': 'minus_four',
}, {
  'name': 'minus_two',
  '$kuid': 'ue3oz79',
  'label': ['-2'],
  'list_name': 'min_ch_list',
  '$autovalue': 'minus_two',
}];

export const everythingSurveySubmission = {
  '_id': 25,
  'Secret_spot': '47.754098 3.426214 0 0',
  'Favourite_chocolate_barcode': '123123123123',
  '_geolocation': [47.754098, 3.426214],
  'Favourite_country': 'ireland',
  'Colours_by_brightness/_1st_choice': 'blue',
  'Favourite_food': 'pizza apple',
  'Selfportrait': '784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
  '_validation_status': {},
  'We_need_your_CV': 'zamki-13_35_5.txt',
  '_uuid': 'fdd252ee-860a-426c-be90-cbbf61787cb9',
  '_bamboo_dataset_id': '',
  '_tags': [],
  '_notes': [],
  'Colours_by_brightness/_2nd_choice': 'yellow',
  'A_video': 'IMG_3619-13_33_22.MOV',
  '_submitted_by': null,
  'How_are_you/outside': 'good',
  '_xform_id_string': 'aXPSbtQcYDm8mcJuVZTUhW',
  'Birth_date': '1900-04-10',
  'meta/instanceID': 'uuid:fdd252ee-860a-426c-be90-cbbf61787cb9',
  'Shortest_path': '26.74561 -1.485606 0 0;18.979026 23.772309 0 0',
  'formhub/uuid': '712e5fb8d7364482a57c60df876c57fb',
  'Birth_time': '13:45:00.000+02:00',
  'end': '2020-04-28T13:35:12.978+02:00',
  'How_are_you/inside': 'bad',
  '_submission_time': '2020-04-28T11:35:26',
  '__version__': 'vbkx6J4Key3yaWF5TGXrxg',
  'test_your_math_2_and_4/test_your_math_2_and_4_minus': 'minus_four',
  'Lucky_number': '24',
  'Are_you_sane': 'OK',
  '_attachments': [{
    'mimetype': 'video/quicktime',
    'download_small_url': 'http://kc.kobo.local/media/small?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2FIMG_3619-13_33_22.MOV',
    'download_large_url': 'http://kc.kobo.local/media/large?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2FIMG_3619-13_33_22.MOV',
    'download_url': 'http://kc.kobo.local/media/original?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2FIMG_3619-13_33_22.MOV',
    'filename': 'kobo/attachments/712e5fb8d7364482a57c60df876c57fb/fdd252ee-860a-426c-be90-cbbf61787cb9/IMG_3619-13_33_22.MOV',
    'instance': 25,
    'download_medium_url': 'http://kc.kobo.local/media/medium?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2FIMG_3619-13_33_22.MOV',
    'id': 6,
    'xform': 18,
  }, {
    'mimetype': 'audio/mpeg',
    'download_small_url': 'http://kc.kobo.local/media/small?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F07.+Crazy+Love-13_32_31.mp3',
    'download_large_url': 'http://kc.kobo.local/media/large?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F07.+Crazy+Love-13_32_31.mp3',
    'download_url': 'http://kc.kobo.local/media/original?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F07.+Crazy+Love-13_32_31.mp3',
    'filename': 'kobo/attachments/712e5fb8d7364482a57c60df876c57fb/fdd252ee-860a-426c-be90-cbbf61787cb9/07. Crazy Love-13_32_31.mp3',
    'instance': 25,
    'download_medium_url': 'http://kc.kobo.local/media/medium?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F07.+Crazy+Love-13_32_31.mp3',
    'id': 5,
    'xform': 18,
  }, {
    'mimetype': 'text/plain',
    'download_small_url': 'http://kc.kobo.local/media/small?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2Fzamki-13_35_5.txt',
    'download_large_url': 'http://kc.kobo.local/media/large?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2Fzamki-13_35_5.txt',
    'download_url': 'http://kc.kobo.local/media/original?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2Fzamki-13_35_5.txt',
    'filename': 'kobo/attachments/712e5fb8d7364482a57c60df876c57fb/fdd252ee-860a-426c-be90-cbbf61787cb9/zamki-13_35_5.txt',
    'instance': 25,
    'download_medium_url': 'http://kc.kobo.local/media/medium?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2Fzamki-13_35_5.txt',
    'id': 4,
    'xform': 18,
  }, {
    'mimetype': 'image/jpeg',
    'download_small_url': 'http://kc.kobo.local/media/small?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
    'download_large_url': 'http://kc.kobo.local/media/large?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
    'download_url': 'http://kc.kobo.local/media/original?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
    'filename': 'kobo/attachments/712e5fb8d7364482a57c60df876c57fb/fdd252ee-860a-426c-be90-cbbf61787cb9/784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
    'instance': 25,
    'download_medium_url': 'http://kc.kobo.local/media/medium?media_file=kobo%2Fattachments%2F712e5fb8d7364482a57c60df876c57fb%2Ffdd252ee-860a-426c-be90-cbbf61787cb9%2F784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
    'id': 3,
    'xform': 18,
  }],
  'Expected_lifespan': '88',
  'start': '2020-04-28T13:30:42.903+02:00',
  'Your_name': 'Leszek',
  'Unlucky_number': '-7',
  'Some_random_date_and_time': '2020-04-02T01:33:00.000+02:00',
  '_status': 'submitted_via_web',
  'Secret_area': '-7.362467 -54.112248 0 0;24.20689 -79.483642 0 0;25.720735 -41.556644 0 0;2.196727 -40.315761 0 0;-7.362467 -54.112248 0 0',
  'Voice_password': '07. Crazy Love-13_32_31.mp3',
  'test_your_math_2_and_4/test_your_math_2_and_4_plus': '7',
};

export const everythingSurveyDisplayData = [
  {
    'type': 'select_one',
    'label': 'Favourite country',
    'name': 'Favourite_country',
    'listName': 'fav_cntr_list',
    'data': 'ireland',
  },
  {
    'type': 'select_multiple',
    'label': 'Favourite food',
    'name': 'Favourite_food',
    'listName': 'fav_food_ch_list',
    'data': 'pizza apple',
  },
  {
    'type': 'text',
    'label': 'Your name',
    'name': 'Your_name',
    'data': 'Leszek',
  },
  {
    'type': 'integer',
    'label': 'Lucky number',
    'name': 'Lucky_number',
    'data': '24',
  },
  {
    'type': 'decimal',
    'label': 'Unlucky number',
    'name': 'Unlucky_number',
    'data': '-7',
  },
  {
    'type': 'date',
    'label': 'Birth date',
    'name': 'Birth_date',
    'data': '1900-04-10',
  },
  {
    'type': 'time',
    'label': 'Birth time',
    'name': 'Birth_time',
    'data': '13:45:00.000+02:00',
  },
  {
    'type': 'datetime',
    'label': 'Some random date and time',
    'name': 'Some_random_date_and_time',
    'data': '2020-04-02T01:33:00.000+02:00',
  },
  {
    'type': 'geopoint',
    'label': 'Secret spot',
    'name': 'Secret_spot',
    'data': '47.754098 3.426214 0 0',
  },
  {
    'type': 'image',
    'label': 'Selfportrait',
    'name': 'Selfportrait',
    'data': '784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
  },
  {
    'type': 'audio',
    'label': 'Voice password',
    'name': 'Voice_password',
    'data': '07. Crazy Love-13_32_31.mp3',
  },
  {
    'type': 'video',
    'label': 'A video?',
    'name': 'A_video',
    'data': 'IMG_3619-13_33_22.MOV',
  },
  {
    'type': 'geotrace',
    'label': 'Shortest path',
    'name': 'Shortest_path',
    'data': '26.74561 -1.485606 0 0;18.979026 23.772309 0 0',
  },
  {
    'type': 'barcode',
    'label': 'Favourite chocolate barcode',
    'name': 'Favourite_chocolate_barcode',
    'data': '123123123123',
  },
  {
    'type': 'acknowledge',
    'label': 'Are you sane?',
    'name': 'Are_you_sane',
    'data': 'OK',
  },
  {
    'type': 'geoshape',
    'label': 'Secret area',
    'name': 'Secret_area',
    'data': '-7.362467 -54.112248 0 0;24.20689 -79.483642 0 0;25.720735 -41.556644 0 0;2.196727 -40.315761 0 0;-7.362467 -54.112248 0 0',
  },
  {
    'type': 'group_regular',
    'label': 'How are you?',
    'name': 'How_are_you',
    'children': [
      {
        'type': 'score__row',
        'label': 'Outside',
        'name': 'outside',
        'listName': 'how_r_u_ch_list',
        'data': 'good',
      },
      {
        'type': 'score__row',
        'label': 'Inside',
        'name': 'inside',
        'listName': 'how_r_u_ch_list',
        'data': 'bad',
      },
    ],
  },
  {
    'type': 'group_matrix',
    'label': 'Test your math',
    'name': 'test_your_math',
    'children': [
      {
        'type': 'group_matrix_row',
        'label': '2 and 4',
        'name': '2_and_4',
        'children': [
          {
            'type': 'integer',
            'label': 'Plus',
            'name': 'plus',
            'data': '7',
          },
          {
            'type': 'select_one',
            'label': 'Minus',
            'name': 'minus',
            'listName': 'min_ch_list',
            'data': 'minus_four',
          },
        ],
      },
    ],
  },
  {
    'type': 'group_regular',
    'label': 'Colours by brightness',
    'name': 'Colours_by_brightness',
    'children': [
      {
        'type': 'rank__level',
        'label': '1st choice',
        'name': '_1st_choice',
        'listName': 'col_br_ch_list',
        'data': 'blue',
      },
      {
        'type': 'rank__level',
        'label': '2nd choice',
        'name': '_2nd_choice',
        'listName': 'col_br_ch_list',
        'data': 'yellow',
      },
    ],
  },
  {
    'type': 'file',
    'label': 'We need your CV',
    'name': 'We_need_your_CV',
    'data': 'zamki-13_35_5.txt',
  },
  {
    'type': 'range',
    'label': 'Expected lifespan',
    'name': 'Expected_lifespan',
    'data': '88',
  },
];

export const matrixRepeatSurvey = [
  {
    'name': 'start',
    'type': 'start',
    '$kuid': '5hhy3gTQM',
    '$autoname': 'start',
  },
  {
    'name': 'end',
    'type': 'end',
    '$kuid': 'gIKQbAuFK',
    '$autoname': 'end',
  },
  {
    'name': 'Simple_repeat',
    'type': 'begin_repeat',
    '$kuid': 'wr4ir59',
    'label': ['Simple repeat'],
    '$autoname': 'Simple_repeat',
  },
  {
    'name': 'Best_food',
    'type': 'begin_kobomatrix',
    '$kuid': 'hn03y22',
    'label': ['Best food'],
    '$autoname': 'Best_food',
    '_isRepeat': 'false',
    'appearance': 'field-list',
    'kobo--matrix_list': 'matrix_ri0sw49',
  },
  {
    'hint': [''],
    'name': 'Salty',
    'type': 'text',
    '$kuid': 'ar3rp04',
    'label': ['Salty'],
    'required': false,
    '$autoname': 'Salty',
    'appearance': 'w1',
  },
  {
    'hint': [''],
    'name': 'Sweet',
    'type': 'text',
    '$kuid': 'qp2gg39',
    'label': ['Sweet'],
    'required': true,
    '$autoname': 'Sweet',
    'appearance': 'w1',
  },
  {
    'type': 'end_kobomatrix',
    '$kuid': '/hn03y22',
  },
  {
    'type': 'end_repeat',
    '$kuid': '/wr4ir59',
  },
];

export const matrixRepeatSurveyChoices = [
  {
    'name': 'baked',
    '$kuid': 'hb7vh55',
    'label': ['Baked'],
    'list_name': 'matrix_ri0sw49',
    '$autovalue': 'baked',
  },
  {
    'name': 'raw',
    '$kuid': 'us3nd72',
    'label': ['Raw'],
    'list_name': 'matrix_ri0sw49',
    '$autovalue': 'raw',
  },
];

export const matrixRepeatSurveySubmission = {
  '_id': 16,
  '_notes': [],
  '_validation_status': {},
  '_uuid': '967be1fa-e015-44f9-af6e-38c795db705a',
  '_bamboo_dataset_id': '',
  '_tags': [],
  '_submitted_by': null,
  '_xform_id_string': 'aZWrtKay885DknXjjoB7NB',
  'meta/instanceID': 'uuid:967be1fa-e015-44f9-af6e-38c795db705a',
  'formhub/uuid': '3d4bb313b9244e97a64339f43bb4317c',
  'end': '2020-08-24T14:50:33.709+02:00',
  'Simple_repeat': [
    {
      'Simple_repeat/Best_food_raw/Best_food_raw_Sweet': 'apple',
      'Simple_repeat/Best_food_baked/Best_food_baked_Salty': 'bread',
      'Simple_repeat/Best_food_baked/Best_food_baked_Sweet': 'pie',
      'Simple_repeat/Best_food_raw/Best_food_raw_Salty': 'olive',
    },
    {
      'Simple_repeat/Best_food_raw/Best_food_raw_Sweet': 'tomato',
      'Simple_repeat/Best_food_baked/Best_food_baked_Salty': 'pizza',
      'Simple_repeat/Best_food_baked/Best_food_baked_Sweet': 'croissant',
      'Simple_repeat/Best_food_raw/Best_food_raw_Salty': 'cucumber',
    },
  ],
  '_submission_time': '2020-08-24T12:50:49',
  '_attachments': [],
  'start': '2020-08-24T14:48:52.577+02:00',
  '_geolocation': [
    null, null,
  ],
  '_status': 'submitted_via_web',
  '__version__': 'vLao7eC5zPrkyAHKYFt9kY',
};

export const matrixRepeatSurveyDisplayData = [
  {
    'type': 'group_repeat',
    'label': 'Simple repeat',
    'name': 'Simple_repeat',
    'children': [
      {
        'type': 'group_matrix',
        'label': 'Best food',
        'name': 'Best_food',
        'children': [
          {
            'type': 'group_matrix_row',
            'label': 'Baked',
            'name': 'baked',
            'children': [
              {
                'type': 'text',
                'label': 'Salty',
                'name': 'Salty',
                'data': 'bread',
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'pie',
              },
            ],
          },
          {
            'type': 'group_matrix_row',
            'label': 'Raw',
            'name': 'raw',
            'children': [
              {
                'type': 'text',
                'label': 'Salty',
                'name': 'Salty',
                'data': 'olive',
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'apple',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    'type': 'group_repeat',
    'label': 'Simple repeat',
    'name': 'Simple_repeat',
    'children': [
      {
        'type': 'group_matrix',
        'label': 'Best food',
        'name': 'Best_food',
        'children': [
          {
            'type': 'group_matrix_row',
            'label': 'Baked',
            'name': 'baked',
            'children': [
              {
                'type': 'text',
                'label': 'Salty',
                'name': 'Salty',
                'data': 'pizza',
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'croissant',
              },
            ],
          },
          {
            'type': 'group_matrix_row',
            'label': 'Raw',
            'name': 'raw',
            'children': [
              {
                'type': 'text',
                'label': 'Salty',
                'name': 'Salty',
                'data': 'cucumber',
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'tomato',
              },
            ],
          },
        ],
      },
    ],
  },
];
