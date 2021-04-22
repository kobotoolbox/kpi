// need an asset with locking profiles included and used for rows

export const simpleTemplate = {
  'url': 'http://kf.kobo.local/api/v2/assets/ag5w6923oyv5NitEW6aez3/',
  'owner': 'http://kf.kobo.local/api/v2/users/kobo/',
  'owner__username': 'kobo',
  'parent': null,
  'settings': {
    'sector': {
      'label': 'Other',
      'value': 'Other',
    },
    'country': {
      'label': 'United States',
      'value': 'USA',
    },
    'description': '',
    'organization': 'Kobo Inc.',
    'share-metadata': true,
  },
  'asset_type': 'template',
  'summary': {
    'geo': false,
    'labels': [
      'Best thing in the world?', 'Person', 'Your name', 'Your age',
    ],
    'columns': [
      'type', 'label', 'required', 'select_from_list_name', 'name',
    ],
    'languages': [
      'English (en)', 'Polski (pl)',
    ],
    'row_count': 4,
    'default_translation': 'English (en)',
  },
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'start',
        'type': 'start',
        '$kuid': 'ZJRmskGCC',
        '$autoname': 'start',
      }, {
        'name': 'end',
        'type': 'end',
        '$kuid': 'JuoCtJWO5',
        '$autoname': 'end',
      }, {
        'type': 'select_one',
        '$kuid': 'ri0lk77',
        'label': [
          'Best thing in the world?', 'Najlepsze na świecie?',
        ],
        'required': false,
        '$autoname': 'Best_thing_in_the_world',
        'select_from_list_name': 'dp8iw04',
      }, {
        'name': 'person',
        'type': 'begin_group',
        '$kuid': 'xl7sb31',
        'label': [
          'Person', 'Osoba',
        ],
        '$autoname': 'person',
      }, {
        'type': 'text',
        '$kuid': 'xw6go48',
        'label': [
          'Your name', 'Twoje imię',
        ],
        'required': false,
        '$autoname': 'Your_name',
      }, {
        'type': 'integer',
        '$kuid': 'wd3rh84',
        'label': [
          'Your age', 'Twój wiek',
        ],
        'required': false,
        '$autoname': 'Your_age',
      }, {
        'type': 'end_group',
        '$kuid': '/xl7sb31',
      },
    ],
    'choices': [
      {
        'name': 'peace',
        '$kuid': '7grWIZ8bE',
        'label': [
          'Peace', 'Pokój',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'peace',
      }, {
        'name': 'love',
        '$kuid': 'I4x3DFdQl',
        'label': [
          'Love', 'Miłość',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'love',
      }, {
        'name': 'understanding',
        '$kuid': 'klWY60huh',
        'label': [
          'Understanding', 'Zrozumienie',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'understanding',
      },
    ],
    'settings': {
      'default_language': 'English (en)',
    },
    'translated': ['label'],
    'translations': ['English (en)', 'Polski (pl)'],
  },
  'uid': 'ag5w6923oyv5NitEW6aez3',
  'kind': 'asset',
  'name': 'Test template',
};

export const simpleTemplateLocked = {
  'url': 'http://kf.kobo.local/api/v2/assets/ag5w6923oyv5NitEW6aez3/',
  'owner': 'http://kf.kobo.local/api/v2/users/kobo/',
  'owner__username': 'kobo',
  'parent': null,
  'settings': {
    'sector': {
      'label': 'Other',
      'value': 'Other',
    },
    'country': {
      'label': 'United States',
      'value': 'USA',
    },
    'description': '',
    'organization': 'Kobo Inc.',
    'share-metadata': true,
  },
  'asset_type': 'template',
  'summary': {
    'geo': false,
    'labels': [
      'Best thing in the world?', 'Person', 'Your name', 'Your age',
    ],
    'columns': [
      'type', 'label', 'required', 'select_from_list_name', 'name',
    ],
    'languages': [
      'English (en)', 'Polski (pl)',
    ],
    'row_count': 4,
    'default_translation': 'English (en)',
  },
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'start',
        'type': 'start',
        '$kuid': 'ZJRmskGCC',
        '$autoname': 'start',
      }, {
        'name': 'end',
        'type': 'end',
        '$kuid': 'JuoCtJWO5',
        '$autoname': 'end',
      }, {
        'type': 'select_one',
        '$kuid': 'ri0lk77',
        'label': [
          'Best thing in the world?', 'Najlepsze na świecie?',
        ],
        'required': false,
        '$autoname': 'Best_thing_in_the_world',
        'select_from_list_name': 'dp8iw04',
        'kobo--locking-profile': 'lock2',
      }, {
        'name': 'person',
        'type': 'begin_group',
        '$kuid': 'xl7sb31',
        'label': [
          'Person', 'Osoba',
        ],
        '$autoname': 'person',
        'kobo--locking-profile': 'lock2',
      }, {
        'type': 'text',
        '$kuid': 'xw6go48',
        'label': [
          'Your name', 'Twoje imię',
        ],
        'required': false,
        '$autoname': 'Your_name',
      }, {
        'type': 'integer',
        '$kuid': 'wd3rh84',
        'label': [
          'Your age', 'Twój wiek',
        ],
        'required': false,
        '$autoname': 'Your_age',
        'kobo--locking-profile': 'mycustomlock1',
      }, {
        'type': 'end_group',
        '$kuid': '/xl7sb31',
      },
    ],
    'choices': [
      {
        'name': 'peace',
        '$kuid': '7grWIZ8bE',
        'label': [
          'Peace', 'Pokój',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'peace',
      }, {
        'name': 'love',
        '$kuid': 'I4x3DFdQl',
        'label': [
          'Love', 'Miłość',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'love',
      }, {
        'name': 'understanding',
        '$kuid': 'klWY60huh',
        'label': [
          'Understanding', 'Zrozumienie',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'understanding',
      },
    ],
    'kobo--locking-profiles': [
      {
        name: 'mycustomlock1',
        restrictions: [
          'choice_add',
          'choice_delete',
          'choice_edit',
          'question_settings_edit',
          'group_label_edit',
          'group_question_order_edit',
          'group_add',
          'question_order_edit',
        ],
      },
      {
        name: 'lock2',
        restrictions: [
          'question_delete',
          'group_delete',
          'translations_manage',
        ],
      },
    ],
    'settings': {
      'default_language': 'English (en)',
      'kobo--locking-profile': 'mycustomlock1',
    },
    'translated': ['label'],
    'translations': ['English (en)', 'Polski (pl)'],
  },
  'uid': 'ag5w6923oyv5NitEW6aez3',
  'kind': 'asset',
  'name': 'Test template',
};
