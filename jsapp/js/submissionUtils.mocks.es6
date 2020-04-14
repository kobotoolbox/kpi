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
    type: 'regular',
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
    type: 'regular',
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
    type: 'repeat',
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
    type: 'repeat',
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
    type: 'repeat',
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
        type: 'repeat',
        label: 'Personal items',
        name: 'group_items',
        children: [
          {
            type: 'text',
            label: 'Item name',
            name: 'Item_name',
            data: 'Notebook'
          },
          {
            type: 'text',
            label: 'Item name',
            name: 'Item_name',
            data: 'Pen'
          },
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
    type: 'repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'text',
        label: 'Name',
        name: 'Name',
        data: 'Leszek'
      },
      {
        type: 'repeat',
        label: 'Personal items',
        name: 'group_items',
        children: []
      }
    ]
  },
  {
    type: 'repeat',
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
        type: 'repeat',
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

export const complexSurvey = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'Pib7JF5xu',
  '$autoname': 'start'
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'T53FExkKQ',
  '$autoname': 'end'
}, {
  'name': 'Family_name',
  'type': 'text',
  '$kuid': '7xSN7GAOp',
  'label': ['Family name', 'Nazwisko rodowe'],
  'required': false,
  '$autoname': 'Family_name'
}, {
  'name': 'group_people',
  'type': 'begin_repeat',
  '$kuid': 'oLtRTpake',
  'label': ['People', 'Ludzie'],
  'required': false,
  '$autoname': 'group_people'
}, {
  'name': 'Person_name',
  'type': 'text',
  '$kuid': 'UgfzJtEe3',
  'label': ['Person name', 'Imię'],
  'required': false,
  '$autoname': 'Person_name'
}, {
  'name': 'Person_age',
  'type': 'integer',
  '$kuid': 'OizUkrBN9',
  'label': ['Person age', 'Wiek'],
  'required': false,
  '$autoname': 'Person_age'
}, {
  'name': 'Born_date',
  'type': 'date',
  '$kuid': 'XZAhBa5Up',
  'label': ['Born date', 'Data urodzenia'],
  'required': false,
  '$autoname': 'Born_date'
}, {
  'name': 'Face',
  'type': 'image',
  '$kuid': 'gFBHGfFKL',
  'label': ['Face', 'Twarz'],
  'required': false,
  '$autoname': 'Face'
}, {
  'name': 'Secret_place',
  'type': 'geopoint',
  '$kuid': 'fziFJKRNw',
  'label': ['Secret place', 'Sekretne miejsce'],
  'required': false,
  '$autoname': 'Secret_place'
}, {
  'name': 'group_pets',
  'type': 'begin_repeat',
  '$kuid': 'xCuO3yqNf',
  'label': ['Pets', 'Zwierzęta'],
  'required': false,
  '$autoname': 'group_pets'
}, {
  'name': 'Pet_name',
  'type': 'text',
  '$kuid': 'DwRbA0iLL',
  'label': ['Pet name', 'Imię zwierzęcia'],
  'required': false,
  '$autoname': 'Pet_name'
}, {
  'name': 'Pet_age',
  'type': 'integer',
  '$kuid': 'Vy4GeVdi7',
  'label': ['Pet age', 'Wiek zwierzęcia'],
  'required': false,
  '$autoname': 'Pet_age'
}, {
  'type': 'end_repeat',
  '$kuid': 'FAo4vJcHb'
}, {
  'name': 'group_favourites',
  'type': 'begin_group',
  '$kuid': 'eLeRPWEqv',
  'label': ['Favourites', 'Ulubione'],
  'required': false,
  '$autoname': 'group_favourites'
}, {
  'name': 'Food',
  'type': 'select_multiple',
  '$kuid': 'YhD3kUim4',
  'label': ['Food', 'Jedzenie'],
  'required': false,
  '$autoname': 'Food',
  'parameters': 'randomize=true',
  'select_from_list_name': 'gv4ho02'
}, {
  'name': 'Colour',
  'type': 'select_one',
  '$kuid': 'z2xNSGMLF',
  'label': ['Colour', 'Kolor'],
  'required': false,
  '$autoname': 'Colour',
  'select_from_list_name': 'wg0om61'
}, {
  'type': 'end_group',
  '$kuid': 'wUSYf2EeO'
}, {
  'type': 'end_repeat',
  '$kuid': 'hZsJxA0fH'
}, {
  'name': 'group_misc_questions',
  'type': 'begin_group',
  '$kuid': 'b6caSEYGO',
  'label': ['Misc questions', 'Różne pytania'],
  'required': false,
  '$autoname': 'group_misc_questions'
}, {
  'name': 'How_are_you',
  'type': 'begin_group',
  '$kuid': '80OXdKvCV',
  '$autoname': 'How_are_you',
  'appearance': 'field-list'
}, {
  'name': 'How_are_you_header',
  'type': 'select_one',
  '$kuid': '8z6EzEgZ3',
  'label': ['How are you?', 'Jak się masz?'],
  '$autoname': 'How_are_you_header',
  'appearance': 'label',
  'select_from_list_name': 'kn1as50'
}, {
  'name': 'Emotionally',
  'type': 'select_one',
  '$kuid': 'hgpU2wE1r',
  'label': ['Emotionally', 'Emocjonalnie'],
  'required': false,
  '$autoname': 'Emotionally',
  'appearance': 'list-nolabel',
  'select_from_list_name': 'kn1as50'
}, {
  'name': 'Physically',
  'type': 'select_one',
  '$kuid': 'z8PEJ58hu',
  'label': ['Physically', 'Fizycznie'],
  'required': false,
  '$autoname': 'Physically',
  'appearance': 'list-nolabel',
  'select_from_list_name': 'kn1as50'
}, {
  'type': 'end_group',
  '$kuid': 'Bnwa0DLo8'
}, {
  'name': 'skills_header',
  'type': 'begin_group',
  '$kuid': 'fEBsOyWhu',
  '$autoname': 'skills_header',
  'appearance': 'w3'
}, {
  'name': 'skills_header_note',
  'type': 'note',
  '$kuid': '1vm0bjpxv',
  'label': ['**Show your skills**', '**Pokaż umiejętności**'],
  'required': false,
  '$autoname': 'skills_header_note',
  'appearance': 'w1'
}, {
  'name': 'skills_header_sum',
  'type': 'note',
  '$kuid': 'mr4lynrqY',
  'label': ['Sum', 'Suma'],
  'required': false,
  '$autoname': 'skills_header_sum',
  'appearance': 'w1'
}, {
  'name': 'skills_header_multiple',
  'type': 'note',
  '$kuid': 'X5FPuenAu',
  'label': ['Multiple', 'Mnożenie'],
  'required': false,
  '$autoname': 'skills_header_multiple',
  'appearance': 'w1'
}, {
  'type': 'end_group',
  '$kuid': 'c1G22pbv3'
}, {
  'name': 'skills_5_and_6',
  'type': 'begin_group',
  '$kuid': 'UWqEDeUUp',
  '$autoname': 'skills_5_and_6',
  'appearance': 'w3'
}, {
  'name': 'skills_5_and_6_note',
  'type': 'note',
  '$kuid': 'jhsCuEtvy',
  'label': ['5 and 6', '5 oraz 6'],
  'required': false,
  '$autoname': 'skills_5_and_6_note',
  'appearance': 'w1'
}, {
  'name': 'skills_5_and_6_sum',
  'type': 'integer',
  '$kuid': 'qpkTFmbI1',
  'label': ['Sum of 5 and 6', 'Suma 5 oraz 6'],
  'required': false,
  '$autoname': 'skills_5_and_6_sum',
  'appearance': 'w1 no-label'
}, {
  'name': 'skills_5_and_6_multiple',
  'type': 'integer',
  '$kuid': 'cItTPtVNA',
  'label': ['Multiple of 5 and 6', 'Mnożenie 5 oraz 6'],
  'required': false,
  '$autoname': 'skills_5_and_6_multiple',
  'appearance': 'w1 no-label'
}, {
  'type': 'end_group',
  '$kuid': 'hOjRSxhed'
}, {
  'name': 'skills_1_and_1',
  'type': 'begin_group',
  '$kuid': 'FvSncJTgI',
  '$autoname': 'skills_1_and_1',
  'appearance': 'w3'
}, {
  'name': 'skills_1_and_1_note',
  'type': 'note',
  '$kuid': 'C3Sy7Wucv',
  'label': ['1 and 1', '1 oraz 1'],
  'required': false,
  '$autoname': 'skills_1_and_1_note',
  'appearance': 'w1'
}, {
  'name': 'skills_1_and_1_sum',
  'type': 'integer',
  '$kuid': 'fp6XJLDAv',
  'label': ['Sum of 1 and 1', 'Suma 1 oraz 1'],
  'required': false,
  '$autoname': 'skills_1_and_1_sum',
  'appearance': 'w1 no-label'
}, {
  'name': 'skills_1_and_1_multiple',
  'type': 'integer',
  '$kuid': 'PEV8cMYg0',
  'label': ['Multiple of 1 and 1', 'Mnożenie 1 oraz 1'],
  'required': false,
  '$autoname': 'skills_1_and_1_multiple',
  'appearance': 'w1 no-label'
}, {
  'type': 'end_group',
  '$kuid': 'mqr7fTjzz'
}, {
  'name': 'Best_things_in_life',
  'type': 'begin_group',
  '$kuid': '5l1Qud3mG',
  '$autoname': 'Best_things_in_life',
  'appearance': 'field-list'
}, {
  'name': 'Best_things_in_life_label',
  'type': 'note',
  '$kuid': 'KlvMKBHQd',
  'label': ['Best things in life', 'Najlepsze rzeczy w życiu'],
  '$autoname': 'Best_things_in_life_label'
}, {
  'name': '_1st_choice',
  'type': 'select_one',
  '$kuid': 'P1iMX5Usu',
  'label': ['1st choice', 'Pierwsza'],
  'required': true,
  '$autoname': '_1st_choice',
  'appearance': 'minimal',
  'constraint_message': 'Items cannot be selected more than once',
  'select_from_list_name': 'sb0kp09'
}, {
  'name': '_2nd_choice',
  'type': 'select_one',
  '$kuid': '7e0v8ie9E',
  'label': ['2nd choice', 'Druga'],
  'required': true,
  '$autoname': '_2nd_choice',
  'appearance': 'minimal',
  'constraint': '${_2nd_choice} != ${_1st_choice}',
  'constraint_message': 'Items cannot be selected more than once',
  'select_from_list_name': 'sb0kp09'
}, {
  'name': '_3rd_choice',
  'type': 'select_one',
  '$kuid': 'mz1DVTqAk',
  'label': ['3rd choice', 'Trzecia'],
  'required': true,
  '$autoname': '_3rd_choice',
  'appearance': 'minimal',
  'constraint': '${_3rd_choice} != ${_1st_choice} and ${_3rd_choice} != ${_2nd_choice}',
  'constraint_message': 'Items cannot be selected more than once',
  'select_from_list_name': 'sb0kp09'
}, {
  'type': 'end_group',
  '$kuid': 'Z7xGrxISM'
}, {
  'type': 'end_group',
  '$kuid': 'jZewXpMXU'
}, {
  'name': 'Choose_a_range',
  'type': 'range',
  '$kuid': 'QX2w5NBxo',
  'label': ['Choose a range', 'Wybierz zakres'],
  'required': false,
  '$autoname': 'Choose_a_range',
  'parameters': 'start=1;end=10;step=1'
}, {
  'name': '__version__',
  'type': 'calculate',
  '$kuid': 'cXDaOqUFe',
  '$autoname': '__version__',
  'calculation': "'vHagmzimVwhMJ4C26sX38Q'"
}];

export const complexSurveySubmission = {
  '_id': 15,
  '_notes': [],
  'Family_name': 'Smith',
  'group_misc_questions/skills_5_and_6/skills_5_and_6_sum': '11',
  '_validation_status': {},
  'group_misc_questions/Best_things_in_life/_1st_choice': 'conquest',
  '_uuid': '3f8a90e9-4900-4f2f-bf57-357069f4dcf8',
  '_bamboo_dataset_id': '',
  'group_misc_questions/Best_things_in_life/_3rd_choice': 'food',
  '_tags': [],
  'group_misc_questions/Best_things_in_life/_2nd_choice': 'swords',
  '_submitted_by': null,
  'group_misc_questions/How_are_you/Physically': 'good',
  'group_misc_questions/How_are_you/Emotionally': 'bad',
  '_xform_id_string': 'a57BHHQ7QH6qWVFt9reqKY',
  'meta/instanceID': 'uuid:3f8a90e9-4900-4f2f-bf57-357069f4dcf8',
  'group_misc_questions/skills_5_and_6/skills_5_and_6_multiple': '30',
  'formhub/uuid': '2c7f8aff2b1d4c4ea436f6c9872ca326',
  'group_misc_questions/skills_1_and_1/skills_1_and_1_sum': '2',
  'end': '2020-03-27T15:33:15.899+01:00',
  'start': '2020-03-27T15:30:07.749+01:00',
  '_submission_time': '2020-03-27T14:33:22',
  'Choose_a_range': '3',
  '_attachments': [{
    'mimetype': 'image/png',
    'download_small_url': 'http://kc.kobo.local/media/small?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Screenshot+2019-05-03+at+17.21.59-15_32_27.png',
    'download_large_url': 'http://kc.kobo.local/media/large?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Screenshot+2019-05-03+at+17.21.59-15_32_27.png',
    'download_url': 'http://kc.kobo.local/media/original?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Screenshot+2019-05-03+at+17.21.59-15_32_27.png',
    'filename': 'kobo/attachments/2c7f8aff2b1d4c4ea436f6c9872ca326/3f8a90e9-4900-4f2f-bf57-357069f4dcf8/___Screenshot 2019-05-03 at 17.21.59-15_32_27.png',
    'instance': 15,
    'download_medium_url': 'http://kc.kobo.local/media/medium?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Screenshot+2019-05-03+at+17.21.59-15_32_27.png',
    'id': 2,
    'xform': 10
  }, {
    'mimetype': 'image/jpeg',
    'download_small_url': 'http://kc.kobo.local/media/small?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Carroll+Dunham+-+Bather-15_31_33.jpg',
    'download_large_url': 'http://kc.kobo.local/media/large?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Carroll+Dunham+-+Bather-15_31_33.jpg',
    'download_url': 'http://kc.kobo.local/media/original?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Carroll+Dunham+-+Bather-15_31_33.jpg',
    'filename': 'kobo/attachments/2c7f8aff2b1d4c4ea436f6c9872ca326/3f8a90e9-4900-4f2f-bf57-357069f4dcf8/___Carroll Dunham - Bather-15_31_33.jpg',
    'instance': 15,
    'download_medium_url': 'http://kc.kobo.local/media/medium?media_file=kobo%2Fattachments%2F2c7f8aff2b1d4c4ea436f6c9872ca326%2F3f8a90e9-4900-4f2f-bf57-357069f4dcf8%2F___Carroll+Dunham+-+Bather-15_31_33.jpg',
    'id': 1,
    'xform': 10
  }],
  'group_people': [{
    'group_people/group_pets': [{
      'group_people/group_pets/Pet_name': 'Frank',
      'group_people/group_pets/Pet_age': '1'
    }, {
      'group_people/group_pets/Pet_name': 'Zoe',
      'group_people/group_pets/Pet_age': '6'
    }, {
      'group_people/group_pets/Pet_name': 'Moe',
      'group_people/group_pets/Pet_age': '109'
    }],
    'group_people/Face': '___Carroll Dunham - Bather-15_31_33.jpg',
    'group_people/group_favourites/Food': 'apple pizza',
    'group_people/Person_age': '66',
    'group_people/Secret_place': '52.48278 18.099317 0 0',
    'group_people/group_favourites/Colour': 'goldenrod',
    'group_people/Born_date': '1990-02-06',
    'group_people/Person_name': 'John'
  }, {
    'group_people/group_pets': [{
      'group_people/group_pets/Pet_name': 'Cricket',
      'group_people/group_pets/Pet_age': '0'
    }],
    'group_people/Face': '___Screenshot 2019-05-03 at 17.21.59-15_32_27.png',
    'group_people/Person_age': '15',
    'group_people/Secret_place': '39.909736 -81.589529 0 0',
    'group_people/group_favourites/Colour': 'chocolate',
    'group_people/Born_date': '2009-11-25',
    'group_people/Person_name': 'Sally'
  }],
  '_geolocation': [null, null],
  'group_misc_questions/skills_1_and_1/skills_1_and_1_multiple': '1',
  '_version_': 'vwLF5ypqLmYrhhrU9nQtPj',
  '_status': 'submitted_via_web',
  '__version__': 'vHagmzimVwhMJ4C26sX38Q'
};

export const complexSurveyDisplayData = [
  {
    type: 'text',
    label: 'Family name',
    name: 'Family_name',
    data: 'Smith'
  },
  {
    type: 'repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'image',
        label: 'Face',
        name: 'Face',
        data: '___Carroll Dunham - Bather-15_31_33.jpg'
      },
      {
        type: 'integer',
        label: 'Person age',
        name: 'Person_age',
        data: '66'
      },
      {
        type: 'geopoint',
        label: 'Secret place',
        name: 'Secret_place',
        data: '52.48278 18.099317 0 0'
      },
      {
        type: 'date',
        label: 'Born date',
        name: 'Born_date',
        data: '1990-02-06'
      },
      {
        type: 'text',
        label: 'Person name',
        name: 'Person_name',
        data: 'John'
      },
      {
        type: 'regular',
        label: 'Favourites',
        name: 'group_favourites',
        children: [
          {
            type: 'select_multiple',
            label: 'Food',
            name: 'Food',
            data: 'apple pizza'
          },
          {
            type: 'select_one',
            label: 'Colour',
            name: 'Colour',
            data: 'goldenrod'
          }
        ]
      },
      {
        type: 'repeat',
        label: 'Pets',
        name: 'group_pets',
        children: [
          {
            type: 'text',
            label: 'Pet name',
            name: 'Pet_name',
            data: 'Frank'
          },
          {
            type: 'integer',
            label: 'Pet age',
            name: 'Pet_age',
            data: '1'
          }
        ]
      },
      {
        type: 'repeat',
        label: 'Pets',
        name: 'group_pets',
        children: [
          {
            type: 'text',
            label: 'Pet name',
            name: 'Pet_name',
            data: 'Zoe'
          },
          {
            type: 'integer',
            label: 'Pet age',
            name: 'Pet_age',
            data: '6'
          }
        ]
      },
      {
        type: 'repeat',
        label: 'Pets',
        name: 'group_pets',
        children: [
          {
            type: 'text',
            label: 'Pet name',
            name: 'Pet_name',
            data: 'Moe'
          },
          {
            type: 'integer',
            label: 'Pet age',
            name: 'Pet_age',
            data: '109'
          }
        ]
      }
    ]
  },
  {
    type: 'repeat',
    label: 'People',
    name: 'group_people',
    children: [
      {
        type: 'image',
        label: 'Face',
        name: 'Face',
        data: '___Screenshot 2019-05-03 at 17.21.59-15_32_27.png'
      },
      {
        type: 'integer',
        label: 'Person age',
        name: 'Person_age',
        data: '15'
      },
      {
        type: 'geopoint',
        label: 'Secret place',
        name: 'Secret_place',
        data: '39.909736 -81.589529 0 0'
      },
      {
        type: 'date',
        label: 'Born date',
        name: 'Born_date',
        data: '2009-11-25'
      },
      {
        type: 'text',
        label: 'Person name',
        name: 'Person_name',
        data: 'Sally'
      },
      {
        type: 'regular',
        label: 'Favourites',
        name: 'group_favourites',
        children: [
          {
            type: 'select_multiple',
            label: 'Food',
            name: 'Food',
            data: null
          },
          {
            type: 'select_one',
            label: 'Colour',
            name: 'Colour',
            data: 'chocolate'
          }
        ]
      },
      {
        type: 'repeat',
        label: 'Pets',
        name: 'group_pets',
        children: [
          {
            type: 'text',
            label: 'Pet name',
            name: 'Pet_name',
            data: 'Cricket'
          },
          {
            type: 'integer',
            label: 'Pet age',
            name: 'Pet_age',
            data: '0'
          }
        ]
      }
    ]
  },
  {
    type: 'regular',
    label: 'Misc questions',
    name: 'group_misc_questions',
    children: [
      {
        type: 'regular',
        label: 'How are you?',
        name: 'How_are_you',
        children: [
          {
            type: 'select_one',
            label: 'Physically',
            name: 'Physically',
            data: 'good'
          },
          {
            type: 'select_one',
            label: 'Emotionally',
            name: 'Emotionally',
            data: 'bad'
          }
        ]
      },
      {
        type: 'regular',
        label: 'Show your skills',
        name: null,
        children: [
          {
            type: 'regular',
            label: '5 and 6',
            name: 'skills_5_and_6',
            children: [
              {
                type: 'integer',
                label: 'Sum of 5 and 6',
                name: 'skills_5_and_6_sum',
                data: '11'
              },
              {
                type: 'integer',
                label: 'Multiple of 5 and 6',
                name: 'skills_5_and_6_multiple',
                data: '30'
              }
            ]
          },
          {
            type: 'regular',
            label: '1 and 1',
            name: 'skills_1_and_1',
            children: [
              {
                type: 'integer',
                label: 'Sum of 1 and 1',
                name: 'skills_1_and_1_sum',
                data: '2'
              },
              {
                type: 'integer',
                label: 'Multiple of 1 and 1',
                name: 'skills_1_and_1_multiple',
                data: '1'
              }
            ]
          }
        ]
      },
      {
        type: 'regular',
        label: 'Best things in life',
        name: 'Best_things_in_life',
        children: [
          {
            type: 'select_one',
            label: '1st choice',
            name: '_1st_choice',
            data: 'conquest'
          }, {
            type: 'select_one',
            label: '2nd choice',
            name: '_2nd_choice',
            data: 'food'
          }, {
            type: 'select_one',
            label: '3rd choice',
            name: '_3rd_choice',
            data: 'swords'
          }
        ]
      }
    ]
  },
  {
    type: 'range',
    label: 'Choose a range',
    name: 'Choose_a_range',
    data: '3'
  }
];
