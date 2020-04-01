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
