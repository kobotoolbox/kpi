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
    xpath: 'First_name',
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
        xpath: 'group_favourites/Favourite_color',
      },
      {
        type: 'integer',
        label: 'Ulubiona liczba',
        name: 'Favourite_number',
        data: '24',
        xpath: 'group_favourites/Favourite_number',
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
    xpath: 'First_name',
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
        xpath: 'group_favourites/Favourite_color',
      },
      {
        type: 'integer',
        label: 'Favourite number',
        name: 'Favourite_number',
        data: '5',
        xpath: 'group_favourites/Favourite_number',
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
        xpath: 'group_members[1]/First_name',
      },
      {
        type: 'text',
        label: 'Middle name',
        name: 'Middle_name',
        data: 'Jan',
        xpath: 'group_members[1]/Middle_name',
      },
      {
        type: 'text',
        label: 'Last name',
        name: 'Last_name',
        data: 'Pietrzak',
        xpath: 'group_members[1]/Last_name',
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
        xpath: 'group_members[2]/First_name',
      },
      {
        type: 'text',
        label: 'Middle name',
        name: 'Middle_name',
        data: null,
        xpath: 'group_members[2]/Middle_name',
      },
      {
        type: 'text',
        label: 'Last name',
        name: 'Last_name',
        data: 'Niepietrzak',
        xpath: 'group_members[2]/Last_name',
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
        xpath: 'group_people[1]/Name',
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
            xpath: 'group_people[1]/group_items[1]/Item_name',
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
            xpath: 'group_people[1]/group_items[2]/Item_name',
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
            xpath: 'group_people[1]/group_items[3]/Item_name',
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
        xpath: 'group_people[2]/Name',
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
        xpath: 'group_people[3]/Name',
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
            xpath: 'group_people[3]/group_items[1]/Item_name',
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
            xpath: 'countries/ecology_level',
          },
          {
            type: 'integer',
            label: 'Secularity level',
            name: 'secularity_level',
            data: '-5',
            xpath: 'countries/secularity_level',
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
        xpath: 'group_people[1]/First_name'
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
        xpath: 'group_people[2]/First_name'
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
        'xpath': 'group_location/Original_location',
      },
      {
        'type': 'geopoint',
        'label': 'Current location',
        'name': 'Current_location',
        'data': '53.748711 -7.880555 0 0',
        'xpath': 'group_location/Current_location',
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
        'xpath': 'Are_you_vegan/Killing_humans',
      },
      {
        'type': 'score__row',
        'label': 'Killing nonhumans',
        'name': 'Killing_nonhumans',
        'listName': 'vg_ch_list',
        'data': 'bad',
        'xpath': 'Are_you_vegan/Killing_nonhumans',
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
        'xpath': 'Best_things_in_life/_1st_choice',
      },
      {
        'type': 'rank__level',
        'label': '2nd choice',
        'name': '_2nd_choice',
        'listName': 'best_ch_list',
        'data': 'sleep',
        'xpath': 'Best_things_in_life/_2nd_choice',
      },
      {
        'type': 'rank__level',
        'label': '3rd choice',
        'name': '_3rd_choice',
        'listName': 'best_ch_list',
        'data': 'food',
        'xpath': 'Best_things_in_life/_3rd_choice',
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
            xpath: 'group_crossbreeding/human',
          },
          {
            type: 'text',
            label: 'Nonhuman',
            name: 'nonhuman',
            data: 'firething',
            xpath: 'group_crossbreeding/nonhuman',
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
            xpath: 'group_crossbreeding/human',
          },
          {
            type: 'text',
            label: 'Nonhuman',
            name: 'nonhuman',
            data: 'waterthing',
            xpath: 'group_crossbreeding/nonhuman',
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
    'xpath': 'Favourite_country',
  },
  {
    'type': 'select_multiple',
    'label': 'Favourite food',
    'name': 'Favourite_food',
    'listName': 'fav_food_ch_list',
    'data': 'pizza apple',
    'xpath': 'Favourite_food',
  },
  {
    'type': 'text',
    'label': 'Your name',
    'name': 'Your_name',
    'data': 'Leszek',
    'xpath': 'Your_name',
  },
  {
    'type': 'integer',
    'label': 'Lucky number',
    'name': 'Lucky_number',
    'data': '24',
    'xpath': 'Lucky_number',
  },
  {
    'type': 'decimal',
    'label': 'Unlucky number',
    'name': 'Unlucky_number',
    'data': '-7',
    'xpath': 'Unlucky_number',
  },
  {
    'type': 'date',
    'label': 'Birth date',
    'name': 'Birth_date',
    'data': '1900-04-10',
    'xpath': 'Birth_date',
  },
  {
    'type': 'time',
    'label': 'Birth time',
    'name': 'Birth_time',
    'data': '13:45:00.000+02:00',
    'xpath': 'Birth_time',
  },
  {
    'type': 'datetime',
    'label': 'Some random date and time',
    'name': 'Some_random_date_and_time',
    'data': '2020-04-02T01:33:00.000+02:00',
    'xpath': 'Some_random_date_and_time',
  },
  {
    'type': 'geopoint',
    'label': 'Secret spot',
    'name': 'Secret_spot',
    'data': '47.754098 3.426214 0 0',
    'xpath': 'Secret_spot',
  },
  {
    'type': 'image',
    'label': 'Selfportrait',
    'name': 'Selfportrait',
    'data': '784397e28b5041d59bef15d5d0b2d0bf--cutaway-dio-13_31_48.jpg',
    'xpath': 'Selfportrait',
  },
  {
    'type': 'audio',
    'label': 'Voice password',
    'name': 'Voice_password',
    'data': '07. Crazy Love-13_32_31.mp3',
    'xpath': 'Voice_password',
  },
  {
    'type': 'video',
    'label': 'A video?',
    'name': 'A_video',
    'data': 'IMG_3619-13_33_22.MOV',
    'xpath': 'A_video',
  },
  {
    'type': 'geotrace',
    'label': 'Shortest path',
    'name': 'Shortest_path',
    'data': '26.74561 -1.485606 0 0;18.979026 23.772309 0 0',
    'xpath': 'Shortest_path',
  },
  {
    'type': 'barcode',
    'label': 'Favourite chocolate barcode',
    'name': 'Favourite_chocolate_barcode',
    'data': '123123123123',
    'xpath': 'Favourite_chocolate_barcode',
  },
  {
    'type': 'acknowledge',
    'label': 'Are you sane?',
    'name': 'Are_you_sane',
    'data': 'OK',
    'xpath': 'Are_you_sane',
  },
  {
    'type': 'geoshape',
    'label': 'Secret area',
    'name': 'Secret_area',
    'data': '-7.362467 -54.112248 0 0;24.20689 -79.483642 0 0;25.720735 -41.556644 0 0;2.196727 -40.315761 0 0;-7.362467 -54.112248 0 0',
    'xpath': 'Secret_area',
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
        'xpath': 'How_are_you/outside',
      },
      {
        'type': 'score__row',
        'label': 'Inside',
        'name': 'inside',
        'listName': 'how_r_u_ch_list',
        'data': 'bad',
        'xpath': 'How_are_you/inside',
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
            'xpath': 'test_your_math/plus',
          },
          {
            'type': 'select_one',
            'label': 'Minus',
            'name': 'minus',
            'listName': 'min_ch_list',
            'data': 'minus_four',
            'xpath': 'test_your_math/minus',
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
        'xpath': 'Colours_by_brightness/_1st_choice',
      },
      {
        'type': 'rank__level',
        'label': '2nd choice',
        'name': '_2nd_choice',
        'listName': 'col_br_ch_list',
        'data': 'yellow',
        'xpath': 'Colours_by_brightness/_2nd_choice',
      },
    ],
  },
  {
    'type': 'file',
    'label': 'We need your CV',
    'name': 'We_need_your_CV',
    'data': 'zamki-13_35_5.txt',
    'xpath': 'We_need_your_CV',
  },
  {
    'type': 'range',
    'label': 'Expected lifespan',
    'name': 'Expected_lifespan',
    'data': '88',
    'xpath': 'Expected_lifespan',
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
                'xpath': 'Simple_repeat/Best_food/Salty'
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'pie',
                'xpath': 'Simple_repeat/Best_food/Sweet',
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
                'xpath': 'Simple_repeat/Best_food/Salty',
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'apple',
                'xpath': 'Simple_repeat/Best_food/Sweet',
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
                'xpath': 'Simple_repeat/Best_food/Salty',
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'croissant',
                'xpath': 'Simple_repeat/Best_food/Sweet',
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
                'xpath': 'Simple_repeat/Best_food/Salty',
              },
              {
                'type': 'text',
                'label': 'Sweet',
                'name': 'Sweet',
                'data': 'tomato',
                'xpath': 'Simple_repeat/Best_food/Sweet',
              },
            ],
          },
        ],
      },
    ],
  },
];

export const submissionWithAttachmentsWithUnicode = {
  '_id': 18,
  'A_picture': 'Un été au Québec (Canada)-19_41_32.jpg',
  'meta/instanceID': 'uuid:4cfa16e8-f29b-41a9-984c-2bf7fe05064b',
  'meta/deprecatedID': 'uuid:f79e88d3-2329-40c7-ab7a-66dde871480c',
  'formhub/uuid': '45748fd461814880bd9545c8c8827d78',
  '__version__': 'vUdsH7ovQn4eCdBtPJyBag',
  '_xform_id_string': 'azCy24QgjprZGrdvbHQXr3',
  '_uuid': '4cfa16e8-f29b-41a9-984c-2bf7fe05064b',
  '_attachments': [
    {
      download_url: 'http://kc.kobo.local/media/original?media_file=kobo%2Fattachments%2F45748fd461814880bd9545c8c8827d78%2F4cfa16e8-f29b-41a9-984c-2bf7fe05064b%2FUn_ete_au_Quebec_Canada-19_41_32.jpg',
      download_large_url: 'http://kc.kobo.local/media/large?media_file=kobo%2Fattachments%2F45748fd461814880bd9545c8c8827d78%2F4cfa16e8-f29b-41a9-984c-2bf7fe05064b%2FUn_ete_au_Quebec_Canada-19_41_32.jpg',
      download_medium_url: 'http://kc.kobo.local/media/medium?media_file=kobo%2Fattachments%2F45748fd461814880bd9545c8c8827d78%2F4cfa16e8-f29b-41a9-984c-2bf7fe05064b%2FUn_ete_au_Quebec_Canada-19_41_32.jpg',
      download_small_url: 'http://kc.kobo.local/media/small?media_file=kobo%2Fattachments%2F45748fd461814880bd9545c8c8827d78%2F4cfa16e8-f29b-41a9-984c-2bf7fe05064b%2FUn_ete_au_Quebec_Canada-19_41_32.jpgg',
      mimetype: 'image/jpeg',
      filename: 'kobo/attachments/45748fd461814880bd9545c8c8827d78/4cfa16e8-f29b-41a9-984c-2bf7fe05064b/Un_ete_au_Quebec_Canada-19_41_32.jpg',
      instance: 18,
      xform: 4,
      id: 13,
    },
  ],
  _geolocation: [
    null,
    null,
  ],
  _notes: [],
  _tags: [],
  _status: 'submitted_via_web',
  _submission_time: '2022-01-26T19:40:11',
  _submitted_by: null,
  _validation_status: {},
};

export const assetWithSupplementalDetails = {
  'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/',
  'owner': 'http://kf.kobo.local/api/v2/users/kobo/',
  'owner__username': 'kobo',
  'parent': null,
  'settings': {},
  'asset_type': 'survey',
  'date_created': '2022-05-12T10:40:02.952931Z',
  'summary': {
    'geo': false,
    'labels': [
      'Your name here',
      'Your selfie goes here',
      'A video? WTF',
      'Secret password as an audio file',
    ],
    'columns': [
      'name',
      'type',
      'label',
      'required',
      'calculation',
    ],
    'lock_all': false,
    'lock_any': false,
    'languages': [
      null,
    ],
    'row_count': 6,
    'name_quality': {
      'ok': 0,
      'bad': 0,
      'good': 6,
      'total': 6,
      'firsts': {},
    },
    'naming_conflicts': [
      '__version__',
    ],
    'default_translation': null,
  },
  'date_modified': '2022-05-12T20:46:11.778140Z',
  'version_id': 'vMQQP3qgzfmC9XFUkaogSu',
  'version__content_hash': '85c5bee02e5c2061afb598870e0308e3e0f818b5',
  'version_count': 6,
  'has_deployment': true,
  'deployed_version_id': 'vFFTm5vKJURadwXxntZda6',
  'deployed_versions': {
    'count': 1,
    'next': null,
    'previous': null,
    'results': [
      {
        'uid': 'vFFTm5vKJURadwXxntZda6',
        'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/versions/vFFTm5vKJURadwXxntZda6/',
        'content_hash': '85c5bee02e5c2061afb598870e0308e3e0f818b5',
        'date_deployed': '2022-05-12T10:40:05.215293Z',
        'date_modified': '2022-05-12 10:40:05.215293+00:00',
      },
    ],
  },
  'deployment__links': {
    'url': 'http://ee.kobo.local/6PTli7y9',
    'single_url': 'http://ee.kobo.local/single/6PTli7y9',
    'single_once_url': 'http://ee.kobo.local/single/fc64e066ac2314795f6f6afe049420dd',
    'offline_url': 'http://ee.kobo.local/x/6PTli7y9',
    'preview_url': 'http://ee.kobo.local/preview/6PTli7y9',
    'iframe_url': 'http://ee.kobo.local/i/6PTli7y9',
    'single_iframe_url': 'http://ee.kobo.local/single/i/6PTli7y9',
    'single_once_iframe_url': 'http://ee.kobo.local/single/i/fc64e066ac2314795f6f6afe049420dd',
  },
  'deployment__active': true,
  'deployment__data_download_links': {
    'xls_legacy': 'http://kc.kobo.local/kobo/exports/aDDywpeYGnvuDLTeiveyxZ/xls/',
    'csv_legacy': 'http://kc.kobo.local/kobo/exports/aDDywpeYGnvuDLTeiveyxZ/csv/',
    'zip_legacy': 'http://kc.kobo.local/kobo/exports/aDDywpeYGnvuDLTeiveyxZ/zip/',
    'kml_legacy': 'http://kc.kobo.local/kobo/exports/aDDywpeYGnvuDLTeiveyxZ/kml/',
    'xls': 'http://kc.kobo.local/kobo/reports/aDDywpeYGnvuDLTeiveyxZ/export.xlsx',
    'csv': 'http://kc.kobo.local/kobo/reports/aDDywpeYGnvuDLTeiveyxZ/export.csv',
  },
  'deployment__submission_count': 3,
  'report_styles': {
    'default': {},
    'specified': {
      'end': {},
      'audit': {},
      'start': {},
      'today': {},
      'deviceid': {},
      'username': {},
      '_version_': {},
      'simserial': {},
      'A_video_WTF': {},
      '__version__': {},
      'phonenumber': {},
      'subscriberid': {},
      'Your_name_here': {},
      'Your_selfie_goes_here': {},
      'Secret_password_as_an_audio_file': {},
    },
    'kuid_names': {
      'end': 'VpPsXe5aq',
      'audit': '4Fbwq3mxP',
      'start': '8sHgNqqM9',
      'today': 'HuEzX4mel',
      'deviceid': 'q8Rvs1sqk',
      'username': '4dINVeRnR',
      '_version_': 'kU3D6JQPQ',
      'simserial': 'WrxreUkAJ',
      'A_video_WTF': 'bMGj1HZfu',
      '__version__': 'Hd5Iz0aWv',
      'phonenumber': 'Oqbll19yc',
      'subscriberid': '8ojkWhAXU',
      'Your_name_here': 'RAeXenoDr',
      'Your_selfie_goes_here': 'MWflesBzX',
      'Secret_password_as_an_audio_file': '3VHKj8Kt4',
    },
  },
  'report_custom': {},
  'advanced_features': {
    'transcript': {
      'values': [
        'A_video_WTF',
        'Secret_password_as_an_audio_file',
      ],
      'languages': [
        'fr',
        'pl',
      ],
    },
    'translated': {
      'values': [
        'Your_name_here',
        'A_video_WTF',
        'Secret_password_as_an_audio_file',
      ],
      'languages': [
        'pl',
        'de',
      ],
    },
    'qual': {
      'qual_survey': [
        {
          'type': 'qual_text',
          'uuid': 'ab0e40e1-fbcc-43e9-9d00-b9b3314089cb',
          'xpath': 'Use_the_camera_s_mic_ne_to_record_a_sound',
          'scope': 'by_question#survey',
          'labels': {
            '_default': 'What is?',
          },
        },
        {
          'type': 'qual_integer',
          'uuid': '97fd5387-ac2b-4108-b5b4-37fa91ae0e22',
          'xpath': 'Use_the_camera_s_mic_ne_to_record_a_sound',
          'scope': 'by_question#survey',
          'labels': {
            '_default': 'How much is the fish?',
          },
        },
        {
          'type': 'qual_tags',
          'uuid': 'b05f29f7-8b58-4dd7-8695-c29cb04f3f7a',
          'xpath': 'Use_the_camera_s_mic_ne_to_record_a_sound',
          'scope': 'by_question#survey',
          'labels': {
            '_default': 'Another tag question here?',
          },
        },
        {
          'type': 'qual_select_multiple',
          'uuid': '1a89e0da-3344-4b5d-b919-ab8b072e0918',
          'xpath': 'Use_the_camera_s_mic_ne_to_record_a_sound',
          'scope': 'by_question#survey',
          'labels': {
            '_default': 'Choose multiple',
          },
          'choices': [
            {
              'uuid': 'b180037c-930b-4025-ba21-1d59ee07485d',
              'labels': {
                '_default': 'First',
              },
            },
            {
              'uuid': 'db4a6b84-4103-4584-a515-27bcf3f0e7ab',
              'labels': {
                '_default': 'Second',
              },
            },
            {
              'uuid': 'fa63c403-2a26-426c-97d6-9b8cfc277545',
              'labels': {
                '_default': 'Third',
              },
            },
          ],
        },
        {
          'type': 'qual_auto_keyword_count',
          'uuid': 'd4813284-d928-43b7-bde5-133eabe76024',
          'xpath': 'Use_the_camera_s_mic_ne_to_record_a_sound',
          'scope': 'by_question#survey',
          'labels': {
            '_default': 'How many swear words were used?',
          },
        },
        {
          'type': 'qual_tags',
          'uuid': '056c8f57-0733-4669-a84e-aa9726ffbf6b',
          'xpath': 'Use_the_camera_s_mic_ne_to_record_a_sound',
          'scope': 'by_question#survey',
          'labels': {
            '_default': 'Do tags work?',
          },
        },
      ],
    },
  },
  'advanced_submission_schema': {
    'type': 'object',
    '$description': 'PATCH or POST a matching JSON structure to a submission and it will be stored and processed accordingly.',
    'url': 'http://kf.kobo.local/advanced_submission_post/aDDywpeYGnvuDLTeiveyxZ',
    'properties': {
      'submission': {
        'type': 'string',
        'description': 'the uuid of the submission',
      },
      'A_video_WTF': {
        'type': 'object',
        'properties': {
          'transcript': {
            '$ref': '#/definitions/transcript',
          },
          'translated': {
            '$ref': '#/definitions/translation',
          },
        },
        'additionalProperties': false,
      },
      'Secret_password_as_an_audio_file': {
        'type': 'object',
        'properties': {
          'transcript': {
            '$ref': '#/definitions/transcript',
          },
          'translated': {
            '$ref': '#/definitions/translation',
          },
        },
        'additionalProperties': false,
      },
      'Your_name_here': {
        'type': 'object',
        'properties': {
          'translated': {
            '$ref': '#/definitions/translation',
          },
        },
        'additionalProperties': false,
      },
    },
    'additionalProperties': false,
    'required': [
      'submission',
    ],
    'definitions': {
      'transcript': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateCreated': {
            'type': 'string',
            'format': 'date-time',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
          'revisions': {
            'type': 'array',
            'items': {
              '$ref': '#/definitions/transcriptRevision',
            },
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
      'transcriptRevision': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
      'xtranslation': {
        'type': 'object',
        'additionalProperties': false,
        'required': [
          'value',
          'languageCode',
        ],
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateCreated': {
            'type': 'string',
            'format': 'date-time',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
          'revisions': {
            'type': 'array',
            'items': {
              '$ref': '#/definitions/translationRevision',
            },
          },
        },
      },
      'translation': {
        'type': 'object',
        'properties': {
          'pl': {
            '$ref': '#/definitions/xtranslation',
          },
          'de': {
            '$ref': '#/definitions/xtranslation',
          },
        },
        'additionalProperties': false,
      },
      'translationRevision': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
    },
  },
  'analysis_form_json': {
    'engines': {
      'engines/transcript_manual': {
        'details': 'A human provided transcription',
      },
      'engines/translated': {
        'details': 'A human provided translation',
      },
    },
    'additional_fields': [
      {
        'type': 'transcript',
        'name': 'A_video_WTF/transcript',
        'label': 'A_video_WTF - transcript',
        'languages': [
          'fr',
          'pl',
        ],
        'path': [
          'A_video_WTF',
          'transcript',
        ],
        'source': 'A_video_WTF',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/transcript_manual',
        },
      },
      {
        'type': 'transcript',
        'name': 'Secret_password_as_an_audio_file/transcript',
        'label': 'Secret_password_as_an_audio_file - transcript',
        'languages': [
          'fr',
          'pl',
        ],
        'path': [
          'Secret_password_as_an_audio_file',
          'transcript',
        ],
        'source': 'Secret_password_as_an_audio_file',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/transcript_manual',
        },
      },
      {
        'type': 'translation',
        'name': 'Your_name_here/translation_pl',
        'label': 'Your_name_here - translation (pl)',
        'language': 'pl',
        'path': [
          'Your_name_here',
          'translation_pl',
        ],
        'source': 'Your_name_here',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/translated',
        },
      },
      {
        'type': 'translation',
        'name': 'Your_name_here/translation_de',
        'label': 'Your_name_here - translation (de)',
        'language': 'de',
        'path': [
          'Your_name_here',
          'translation_de',
        ],
        'source': 'Your_name_here',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/translated',
        },
      },
      {
        'type': 'translation',
        'name': 'A_video_WTF/translation_pl',
        'label': 'A_video_WTF - translation (pl)',
        'language': 'pl',
        'path': [
          'A_video_WTF',
          'translation_pl',
        ],
        'source': 'A_video_WTF',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/translated',
        },
      },
      {
        'type': 'translation',
        'name': 'A_video_WTF/translation_de',
        'label': 'A_video_WTF - translation (de)',
        'language': 'de',
        'path': [
          'A_video_WTF',
          'translation_de',
        ],
        'source': 'A_video_WTF',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/translated',
        },
      },
      {
        'type': 'translation',
        'name': 'Secret_password_as_an_audio_file/translation_pl',
        'label': 'Secret_password_as_an_audio_file - translation (pl)',
        'language': 'pl',
        'path': [
          'Secret_password_as_an_audio_file',
          'translation_pl',
        ],
        'source': 'Secret_password_as_an_audio_file',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/translated',
        },
      },
      {
        'type': 'translation',
        'name': 'Secret_password_as_an_audio_file/translation_de',
        'label': 'Secret_password_as_an_audio_file - translation (de)',
        'language': 'de',
        'path': [
          'Secret_password_as_an_audio_file',
          'translation_de',
        ],
        'source': 'Secret_password_as_an_audio_file',
        'settings': {
          'mode': 'auto',
          'engine': 'engines/translated',
        },
      },
    ],
  },
  'map_styles': {},
  'map_custom': {},
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'start',
        'type': 'start',
        '$kuid': '8sHgNqqM9',
        '$autoname': 'start',
      },
      {
        'name': 'end',
        'type': 'end',
        '$kuid': 'VpPsXe5aq',
        '$autoname': 'end',
      },
      {
        'name': 'today',
        'type': 'today',
        '$kuid': 'HuEzX4mel',
        '$autoname': 'today',
      },
      {
        'name': 'username',
        'type': 'username',
        '$kuid': '4dINVeRnR',
        '$autoname': 'username',
      },
      {
        'name': 'simserial',
        'type': 'simserial',
        '$kuid': 'WrxreUkAJ',
        '$autoname': 'simserial',
      },
      {
        'name': 'subscriberid',
        'type': 'subscriberid',
        '$kuid': '8ojkWhAXU',
        '$autoname': 'subscriberid',
      },
      {
        'name': 'deviceid',
        'type': 'deviceid',
        '$kuid': 'q8Rvs1sqk',
        '$autoname': 'deviceid',
      },
      {
        'name': 'phonenumber',
        'type': 'phonenumber',
        '$kuid': 'Oqbll19yc',
        '$autoname': 'phonenumber',
      },
      {
        'name': 'audit',
        'type': 'audit',
        '$kuid': '4Fbwq3mxP',
        '$autoname': 'audit',
      },
      {
        'name': 'Your_name_here',
        'type': 'text',
        '$kuid': 'RAeXenoDr',
        'label': [
          'Your name here',
        ],
        'required': false,
        '$autoname': 'Your_name_here',
      },
      {
        'name': 'Your_selfie_goes_here',
        'type': 'image',
        '$kuid': 'MWflesBzX',
        'label': [
          'Your selfie goes here',
        ],
        'required': false,
        '$autoname': 'Your_selfie_goes_here',
      },
      {
        'name': 'A_video_WTF',
        'type': 'video',
        '$kuid': 'bMGj1HZfu',
        'label': [
          'A video? WTF',
        ],
        'required': false,
        '$autoname': 'A_video_WTF',
      },
      {
        'name': 'Secret_password_as_an_audio_file',
        'type': 'audio',
        '$kuid': '3VHKj8Kt4',
        'label': [
          'Secret password as an audio file',
        ],
        'required': false,
        '$autoname': 'Secret_password_as_an_audio_file',
      },
      {
        'name': '__version__',
        'type': 'calculate',
        '$kuid': 'Hd5Iz0aWv',
        'required': false,
        '$autoname': '__version__',
        'calculation': "'vhazs7e47xB9GYwY3tbYtS'",
      },
      {
        'name': '_version_',
        'type': 'calculate',
        '$kuid': 'kU3D6JQPQ',
        '$autoname': '_version_',
        '$given_name': '__version__',
        'calculation': "'vjtVxWH3Xmcoz6VFtqfbVr'",
      },
    ],
    'settings': {
      'version': '3 (2021-12-28 13:33:41)',
      'id_string': 'text_and_media_project',
    },
    'translated': [
      'label',
    ],
    'translations': [
      null,
    ],
  },
  'downloads': [
    {
      'format': 'xls',
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ.xls',
    },
    {
      'format': 'xml',
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ.xml',
    },
  ],
  'embeds': [
    {
      'format': 'xls',
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/xls/',
    },
    {
      'format': 'xform',
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/xform/',
    },
  ],
  'xform_link': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/xform/',
  'hooks_link': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/hooks/',
  'tag_string': '',
  'uid': 'aDDywpeYGnvuDLTeiveyxZ',
  'kind': 'asset',
  'xls_link': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/xls/',
  'name': 'text and media projekt',
  'assignable_permissions': [
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      'label': 'View form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      'label': 'Edit form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      'label': 'Manage project',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      'label': 'View submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/partial_submissions/',
      'label': {
        'default': 'Act on submissions only from specific users',
        'view_submissions': 'View submissions only from specific users',
        'change_submissions': 'Edit submissions only from specific users',
        'delete_submissions': 'Delete submissions only from specific users',
        'validate_submissions': 'Validate submissions only from specific users',
      },
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      'label': 'Edit submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      'label': 'Delete submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      'label': 'Validate submissions',
    },
  ],
  'permissions': [
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/pDbXju7qDP7f4TiPnhvN2V/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/pRbazEkwqBFAT4K775yWK5/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      'label': 'Edit form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/pAVAdfoKu2zHjgw2ZaPvKk/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      'label': 'Edit submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/pETWb6s6ezB9gs7vpMpHhZ/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      'label': 'Delete submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/pQoaazdrQ2pBRjqiMpcyc2/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      'label': 'Manage project',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/pEqtSwGsEJzot98Ms3JJpL/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      'label': 'Validate submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/p62cADJonW8XuVPkaMSQcj/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      'label': 'View form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/permission-assignments/p6FKWfL4SuxUqXhsJWdkkB/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      'label': 'View submissions',
    },
  ],
  'exports': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/exports/',
  'export_settings': [],
  'data': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/data/',
  'children': {
    'count': 0,
  },
  'subscribers_count': 0,
  'status': 'private',
  'access_types': null,
  'data_sharing': {},
  'paired_data': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/paired-data/',
};

export const submissionWithSupplementalDetails = {
  '_id': 3,
  'formhub/uuid': 'c71e63f6afa64b31ba70b2fbbb710cf4',
  'start': '2022-05-12T12:42:07.034+02:00',
  'end': '2022-05-12T12:42:21.160+02:00',
  'today': '2022-05-12',
  'username': 'username not found',
  'simserial': 'simserial not found',
  'subscriberid': 'subscriberid not found',
  'deviceid': 'ee.kobo.local:SnU3c4G76jpfMlEg',
  'phonenumber': 'phonenumber not found',
  'Your_name_here': 'David',
  'Secret_password_as_an_audio_file': '8BP076-09-rushjet1-unknown_sector-12_42_20.mp3',
  '__version__': 'vhazs7e47xB9GYwY3tbYtS',
  '_version_': 'vjtVxWH3Xmcoz6VFtqfbVr',
  '_version__001': 'vFFTm5vKJURadwXxntZda6',
  'meta/instanceID': 'uuid:58c71236-f713-471b-bd4c-2a5f2e6b9a05',
  '_xform_id_string': 'aDDywpeYGnvuDLTeiveyxZ',
  '_uuid': '58c71236-f713-471b-bd4c-2a5f2e6b9a05',
  '_attachments': [
    {
      'download_url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/data/3/attachments/3/',
      'download_large_url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/data/3/attachments/3/',
      'download_medium_url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/data/3/attachments/3/',
      'download_small_url': 'http://kf.kobo.local/api/v2/assets/aDDywpeYGnvuDLTeiveyxZ/data/3/attachments/3/',
      'mimetype': 'audio/mpeg',
      'filename': 'kobo/attachments/c71e63f6afa64b31ba70b2fbbb710cf4/58c71236-f713-471b-bd4c-2a5f2e6b9a05/8BP076-09-rushjet1-unknown_sector-12_42_20.mp3',
      'instance': 3,
      'xform': 1,
      'id': 3,
    },
  ],
  '_status': 'submitted_via_web',
  '_geolocation': [
    null,
    null,
  ],
  '_submission_time': '2022-05-12T10:42:37',
  '_tags': [],
  '_notes': [],
  '_validation_status': {},
  '_submitted_by': null,
  '_supplementalDetails': {
    'Secret_password_as_an_audio_file': {
      'transcript': {
        'value': 'This is french transcript text.',
        'revisions': [],
        'dateCreated': '2022-05-12 10:47:51',
        'dateModified': '2022-05-12 10:47:51',
        'languageCode': 'fr',
      },
      'translation': {
        'de': {
          'value': 'This is german translation text.',
          'revisions': [
            {
              'dateModified': '2022-05-12T20:46:21Z',
            },
          ],
          'dateCreated': '2022-05-12T20:46:21Z',
          'dateModified': '2022-05-12T20:46:21Z',
          'languageCode': 'de',
        },
        'pl': {
          'value': 'This is polish translation text.',
          'revisions': [],
          'dateCreated': '2022-05-12T20:45:46Z',
          'dateModified': '2022-05-12T20:45:46Z',
          'languageCode': 'pl',
        },
      },
      'qual': [
        {
          'val': [
            'best',
            'things',
            'ever recorder by human',
            '3',
          ],
          'type': 'qual_tags',
          'uuid': 'b05f29f7-8b58-4dd7-8695-c29cb04f3f7a',
        },
        {
          'val': 12345,
          'type': 'qual_integer',
          'uuid': '97fd5387-ac2b-4108-b5b4-37fa91ae0e22',
        },
        {
          'val': 'a thing',
          'type': 'qual_text',
          'uuid': 'ab0e40e1-fbcc-43e9-9d00-b9b3314089cb',
        },
        {
          'val': [
            {
              labels: {
                _default: 'First',
              },
              val: 'b180037c-930b-4025-ba21-1d59ee07485d',
            },
            {
              labels: {
                _default: 'Third',
              },
              val: 'fa63c403-2a26-426c-97d6-9b8cfc277545',
            },
          ],
          'type': 'qual_select_multiple',
          'uuid': '1a89e0da-3344-4b5d-b919-ab8b072e0918',
        },
        {
          'val': [
            'wow',
            'this works',
            'f me',
            'alpha beta gamma',
          ],
          'type': 'qual_tags',
          'uuid': '056c8f57-0733-4669-a84e-aa9726ffbf6b',
        },
        {
          'val': {
            labels: {
              _default: 'Yes',
            },
            val: '33f4e83d-4bd7-4dbc-b80b-94cac72944fb',
          },
          'type': 'qual_select_one',
          'uuid': '6f230992-b0c4-4cf4-a4a3-a5bd5b50ab4d',
        },
      ],
    },
  },
};
