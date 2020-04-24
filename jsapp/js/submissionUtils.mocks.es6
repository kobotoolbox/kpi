export const simpleSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': '9PMXyB7Sv',
  '$autoname': 'start'
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'AkKyOYSIP',
  '$autoname': 'end'
}, {
  'type': 'text',
  '$kuid': 'uw4if17',
  'label': ['First name', 'Pierwsze imię'],
  'required': false,
  '$autoname': 'First_name'
}, {
  'name': 'group_favourites',
  'type': 'begin_group',
  '$kuid': 'fx8qb06',
  'label': ['Favourites', 'Ulubione'],
  '$autoname': 'group_favourites'
}, {
  'type': 'select_one',
  '$kuid': 'az1fc41',
  'label': ['Favourite color', 'Ulubiony kolor'],
  'required': false,
  '$autoname': 'Favourite_color',
  'select_from_list_name': 'in5tz30'
}, {
  'type': 'integer',
  '$kuid': 'ka9pv41',
  'label': ['Favourite number', 'Ulubiona liczba'],
  'required': false,
  '$autoname': 'Favourite_number'
}, {
  'type': 'end_group',
  '$kuid': '/fx8qb06'
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
    label: 'First name',
    name: 'First_name',
    data: 'Leszek'
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
        data: 'pink'
      },
      {
        type: 'integer',
        label: 'Favourite number',
        name: 'Favourite_number',
        data: '24'
      }
    ]
  }
];

export const simpleSurveyDisplayDataEmpty = [
  {
    type: 'text',
    label: 'First name',
    name: 'First_name',
    data: null
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
        data: null
      },
      {
        type: 'integer',
        label: 'Favourite number',
        name: 'Favourite_number',
        data: '5'
      }
    ]
  }
];

export const repeatSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'lMV6oqDcf',
  '$autoname': 'start'
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'sdwqjbndr',
  '$autoname': 'end'
}, {
  'name': 'group_members',
  'type': 'begin_repeat',
  '$kuid': 'fd8yo77',
  'label': ['Members'],
  'required': false,
  '$autoname': 'group_members'
}, {
  'type': 'text',
  '$kuid': 'lm2ww64',
  'label': ['First name'],
  'required': false,
  '$autoname': 'First_name'
}, {
  'type': 'text',
  '$kuid': 'nf9gq14',
  'label': ['Middle name'],
  'required': false,
  '$autoname': 'Middle_name'
}, {
  'type': 'text',
  '$kuid': 'qt6mr31',
  'label': ['Last name'],
  'required': false,
  '$autoname': 'Last_name'
}, {
  'type': 'end_repeat',
  '$kuid': '/fd8yo77'
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
    'group_members/Last_name': 'Pietrzak'
  }, {
    'group_members/Last_name': 'Niepietrzak'
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
        data: 'Leszek'
      },
      {
        type: 'text',
        label: 'Middle name',
        name: 'Middle_name',
        data: 'Jan'
      },
      {
        type: 'text',
        label: 'Last name',
        name: 'Last_name',
        data: 'Pietrzak'
      }
    ]
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
        data: null
      },
      {
        type: 'text',
        label: 'Middle name',
        name: 'Middle_name',
        data: null
      },
      {
        type: 'text',
        label: 'Last name',
        name: 'Last_name',
        data: 'Niepietrzak'
      }
    ]
  }
];

export const nestedRepeatSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'Rq36zKyog',
  '$autoname': 'start'
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'Redw9OtxY',
  '$autoname': 'end'
}, {
  'type': 'begin_repeat',
  'label': ['People'],
  'name': 'group_people',
  '$kuid': 'aj45t09',
  '$autoname': 'group_people'
}, {
  'type': 'text',
  'label': ['Name'],
  'required': false,
  '$kuid': 'bj78z02',
  '$autoname': 'Name'
}, {
  'type': 'begin_repeat',
  'label': ['Personal items'],
  'name': 'group_items',
  '$kuid': 'te04d01',
  '$autoname': 'group_items'
}, {
  'type': 'text',
  'label': ['Item name'],
  'required': false,
  '$kuid': 'fd1ec62',
  '$autoname': 'Item_name'
}, {
  'type': 'end_repeat',
  '$kuid': '/te04d01'
}, {
  'type': 'end_repeat',
  '$kuid': '/aj45t09'
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
      'group_people/group_items/Item_name': 'Notebook'
    }, {
      'group_people/group_items/Item_name': 'Pen'
    }, {
      'group_people/group_items/Item_name': 'Shoe'
    }],
    'group_people/Name': 'John'
  }, {
    'group_people/Name': 'Leszek'
  }, {
    'group_people/group_items': [{
      'group_people/group_items/Item_name': 'Computer'
    }]
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
        data: 'John'
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
            data: 'Notebook'
          }
        ]
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
            data: 'Pen'
          }
        ]
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
            data: 'Shoe'
          }
        ]
      }
    ]
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
        data: 'Leszek'
      }
    ]
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
        data: null
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
            data: 'Computer'
          }
        ]
      }
    ]
  }
];

export const matrixSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'HVwODOAEK',
  '$autoname': 'start'
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': '32gE3g5ST',
  '$autoname': 'end'
}, {
  'name': 'today',
  'type': 'today',
  '$kuid': '3h9Nl2bpx',
  '$autoname': 'today'
}, {
  'name': 'username',
  'type': 'username',
  '$kuid': '3RscqJRor',
  '$autoname': 'username'
}, {
  'name': 'simserial',
  'type': 'simserial',
  '$kuid': 'ozNn7JwMd',
  '$autoname': 'simserial'
}, {
  'name': 'subscriberid',
  'type': 'subscriberid',
  '$kuid': 'tStWXbDyQ',
  '$autoname': 'subscriberid'
}, {
  'name': 'deviceid',
  'type': 'deviceid',
  '$kuid': 'll7GCh9oi',
  '$autoname': 'deviceid'
}, {
  'name': 'phonenumber',
  'type': 'phonenumber',
  '$kuid': 'b02UNLdMV',
  '$autoname': 'phonenumber'
}, {
  'name': 'countries',
  'type': 'begin_kobomatrix',
  '$kuid': 'en5ri38',
  'label': ['Countries'],
  'required': false,
  '$autoname': 'countries',
  '_isRepeat': 'false',
  'appearance': 'field-list',
  'kobo--matrix_list': 'matrix_fs3ka58'
}, {
  'hint': [''],
  'name': 'ecology_level',
  'type': 'integer',
  '$kuid': 'mi7ka64',
  'label': ['Ecology level'],
  'required': false,
  '$autoname': 'ecology_level',
  'appearance': 'w1'
}, {
  'hint': [''],
  'name': 'secularity_level',
  'type': 'integer',
  '$kuid': 'iy4fw00',
  'label': ['Secularity level'],
  'required': false,
  '$autoname': 'secularity_level',
  'appearance': 'w1'
}, {
  'type': 'end_kobomatrix',
  '$kuid': '/en5ri38'
}];

export const matrixSurveyChoices = [{
  'name': 'poland',
  '$kuid': 'wa9kl23',
  'label': ['Poland'],
  'list_name': 'matrix_fs3ka58',
  '$autovalue': 'poland'
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
  'today': '2020-04-20'
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
            data: '3'
          },
          {
            type: 'integer',
            label: 'Secularity level',
            name: 'secularity_level',
            data: '-5'
          }
        ]
      }
    ]
  }
];

export const groupsSurvey = [{
  'name': 'group_people',
  'type': 'begin_repeat',
  '$kuid': 'fs1km00',
  'label': ['People'],
  '$autoname': 'group_people'
}, {
  'type': 'text',
  '$kuid': 'sr97c95',
  'label': ['First name'],
  'required': false,
  '$autoname': 'First_name'
}, {
  'type': 'end_repeat',
  '$kuid': '/fs1km00'
}, {
  'name': 'group_location',
  'type': 'begin_group',
  '$kuid': 'lq0th66',
  'label': ['Location'],
  '$autoname': 'group_location'
}, {
  'type': 'geopoint',
  '$kuid': 'ug36q69',
  'label': ['Original location'],
  'required': false,
  '$autoname': 'Original_location'
}, {
  'type': 'geopoint',
  '$kuid': 'kw6zd49',
  'label': ['Current location'],
  'required': false,
  '$autoname': 'Current_location'
}, {
  'type': 'end_group',
  '$kuid': '/lq0th66'
}, {
  'type': 'begin_score',
  '$kuid': 'rd0zi80',
  'label': ['Are you vegan?'],
  'required': false,
  '$autoname': 'Are_you_vegan',
  'kobo--score-choices': 'cv0ok80'
}, {
  'type': 'score__row',
  '$kuid': 'as5gb66',
  'label': ['Killing humans'],
  '$autoname': 'Killing_humans'
}, {
  'type': 'score__row',
  '$kuid': 'kv3uq84',
  'label': ['Killing nonhumans'],
  '$autoname': 'Killing_nonhumans'
}, {
  'type': 'end_score',
  '$kuid': '/rd0zi80'
}, {
  'type': 'begin_rank',
  '$kuid': 'bj3zo95',
  'label': ['Best things in life'],
  'required': false,
  '$autoname': 'Best_things_in_life',
  'kobo--rank-items': 'oe89v01',
  'kobo--rank-constraint-message': 'Items cannot be selected more than once'
}, {
  'type': 'rank__level',
  '$kuid': 'yy8lt23',
  'label': ['1st choice'],
  '$autoname': '_1st_choice'
}, {
  'type': 'rank__level',
  '$kuid': 'll0ky89',
  'label': ['2nd choice'],
  '$autoname': '_2nd_choice'
}, {
  'type': 'rank__level',
  '$kuid': 'cz6uz72',
  'label': ['3rd choice'],
  '$autoname': '_3rd_choice'
}, {
  'type': 'end_rank',
  '$kuid': '/bj3zo95'
}, {
  'name': 'group_crossbreeding',
  'type': 'begin_kobomatrix',
  '$kuid': 'vs75w20',
  'label': ['Crossbreeding'],
  '$autoname': 'group_crossbreeding',
  '_isRepeat': 'false',
  'appearance': 'field-list',
  'kobo--matrix_list': 'matrix_go11n34'
}, {
  'hint': [''],
  'name': 'human',
  'type': 'text',
  '$kuid': 'ji8zj93',
  'label': ['Human'],
  'required': false,
  '$autoname': 'human',
  'appearance': 'w1'
}, {
  'hint': [''],
  'name': 'nonhuman',
  'type': 'text',
  '$kuid': 'on6ec28',
  'label': ['Nonhuman'],
  'required': false,
  '$autoname': 'nonhuman',
  'appearance': 'w1'
}, {
  'type': 'end_kobomatrix',
  '$kuid': '/vs75w20'
}];

export const groupsSurveyChoices = [{
  'name': 'good',
  '$kuid': '4g11EC3jB',
  'label': ['Good'],
  'list_name': 'cv0ok80',
  '$autovalue': 'good'
}, {
  'name': 'bad',
  '$kuid': 'iWSKBTsBL',
  'label': ['Bad'],
  'list_name': 'cv0ok80',
  '$autovalue': 'bad'
}, {
  'name': 'food',
  '$kuid': 'gZdFOT2Au',
  'label': ['Food'],
  'list_name': 'oe89v01',
  '$autovalue': 'food'
}, {
  'name': 'sleep',
  '$kuid': '29qNZUz3S',
  'label': ['Sleep'],
  'list_name': 'oe89v01',
  '$autovalue': 'sleep'
}, {
  'name': 'conquest',
  '$kuid': 'U0A1jTOH9',
  'label': ['Conquest'],
  'list_name': 'oe89v01',
  '$autovalue': 'conquest'
}, {
  'name': 'fire',
  '$kuid': 'dl9lc82',
  'label': ['Fire'],
  'list_name': 'matrix_go11n34',
  '$autovalue': 'fire'
}, {
  'name': 'water',
  '$kuid': 'qn03v13',
  'label': ['Water'],
  'list_name': 'matrix_go11n34',
  '$autovalue': 'water'
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
    'group_people/First_name': 'Leszek'
  }, {
    'group_people/First_name': 'John'
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
  'today': '2020-04-23'
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
        data: 'Leszek'
      }
    ]
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
        data: 'John'
      }
    ]
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
        'data': '52.48278 18.813458 0 0'
      },
      {
        'type': 'geopoint',
        'label': 'Current location',
        'name': 'Current_location',
        'data': '53.748711 -7.880555 0 0'
      }
    ]
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
        'data': 'good'
      },
      {
        'type': 'score__row',
        'label': 'Killing nonhumans',
        'name': 'Killing_nonhumans',
        'data': 'bad'
      }
    ]
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
        'data': 'conquest'
      },
      {
        'type': 'rank__level',
        'label': '2nd choice',
        'name': '_2nd_choice',
        'data': 'sleep'
      },
      {
        'type': 'rank__level',
        'label': '3rd choice',
        'name': '_3rd_choice',
        'data': 'food'
      }
    ]
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
            data: 'fireman'
          },
          {
            type: 'text',
            label: 'Nonhuman',
            name: 'nonhuman',
            data: 'firething'
          }
        ]
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
            data: 'waterman'
          },
          {
            type: 'text',
            label: 'Nonhuman',
            name: 'nonhuman',
            data: 'waterthing'
          }
        ]
      },
    ]
  }
];
