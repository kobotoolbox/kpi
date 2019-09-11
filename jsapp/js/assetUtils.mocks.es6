export const surveyWithGroups = [
  {
    '$autoname': 'start',
    '$kuid': 'RCRVJs6v8',
    'type': 'start',
    'name': 'start'
  }, {
    '$autoname': 'end',
    '$kuid': 'Oaffb3Ce1',
    'type': 'end',
    'name': 'end'
  }, {
    '$autoname': 'Your_place',
    '$kuid': 'ry17h97',
    'required': false,
    'type': 'geopoint',
    'label': ['Your place']
  }, {
    '$autoname': 'Your_name',
    '$kuid': 'bp66l95',
    'required': false,
    'type': 'text',
    'label': ['Your name']
  }, {
    '$autoname': 'group_breakfast',
    '$kuid': 'eu4rd78',
    'type': 'begin_group',
    'name': 'group_breakfast',
    'label': ['Breakfast']
  }, {
    '$autoname': 'When_did_you_eat',
    '$kuid': 'sn0ll77',
    'required': false,
    'type': 'time',
    'label': ['When did you eat?']
  }, {
    '$autoname': 'What_did_you_eat',
    '$kuid': 'lh5jq54',
    'required': false,
    'type': 'text',
    'label': ['What did you eat?']
  }, {
    '$kuid': '/eu4rd78',
    'type': 'end_group'
  }, {
    '$autoname': 'group_snacks',
    '$kuid': 'yq4bo29',
    'type': 'begin_repeat',
    'name': 'group_snacks',
    'label': ['Snacks during the day']
  }, {
    '$autoname': 'Snack_name',
    '$kuid': 'tb3mh66',
    'required': false,
    'type': 'text',
    'label': ['Snack name']
  }, {
    '$autoname': 'Time_of_consumption',
    '$kuid': 'tq2zv81',
    'required': false,
    'type': 'time',
    'label': ['Time of consumption']
  }, {
    '$autoname': 'group_nutrients',
    '$kuid': 'su3ww56',
    'type': 'begin_group',
    'name': 'group_nutrients',
    'label': ['Nutrients']
  }, {
    '$autoname': 'How_much_protein_was_it',
    '$kuid': 'bg5yt06',
    'required': false,
    'type': 'integer',
    'label': ['How much protein was it?']
  }, {
    '$autoname': 'How_much_H2O_was_it',
    '$kuid': 'iz5bf84',
    'required': false,
    'type': 'integer',
    'label': ['How much H2O was it?']
  }, {
    '$kuid': '/su3ww56',
    'type': 'end_group'
  }, {
    '$kuid': '/yq4bo29',
    'type': 'end_repeat'
  }, {
    '$autoname': 'group_favs',
    '$kuid': 'vy2km60',
    'type': 'begin_group',
    'name': 'group_favs',
    'label': ['Favourites']
  }, {
    '$autoname': 'Favourite_food',
    '$kuid': 'yt3yl96',
    'required': false,
    'type': 'text',
    'label': ['Favourite food']
  }, {
    '$autoname': 'group_favplant',
    '$kuid': 'vj5yb24',
    'type': 'begin_group',
    'name': 'group_favplant',
    'label': ['Favourite plant food']
  }, {
    '$autoname': 'Favourite_fruit',
    '$kuid': 'wa1gp21',
    'required': false,
    'type': 'text',
    'label': ['Favourite fruit']
  }, {
    '$autoname': 'group_favveg',
    '$kuid': 'qq1rn39',
    'type': 'begin_group',
    'name': 'group_favveg',
    'label': ['Favourite vegetables']
  }, {
    '$autoname': 'Favourite_carrot',
    '$kuid': 'ik3zw20',
    'required': false,
    'type': 'text',
    'label': ['Favourite carrot']
  }, {
    '$autoname': 'Favourite_potato',
    '$kuid': 'ea5uq17',
    'required': false,
    'type': 'text',
    'label': ['Favourite potato']
  }, {
    '$kuid': '/qq1rn39',
    'type': 'end_group'
  }, {
    '$kuid': '/vj5yb24',
    'type': 'end_group'
  }, {
    '$autoname': 'group_favvegan',
    '$kuid': 'oe2bb55',
    'type': 'begin_group',
    'name': 'group_favvegan',
    'label': ['Favourite vegan stuff']
  }, {
    '$autoname': 'Favourite_vegan_hummus',
    '$kuid': 'lk4jn23',
    'required': false,
    'type': 'text',
    'label': ['Favourite vegan hummus']
  }, {
    '$kuid': '/oe2bb55',
    'type': 'end_group'
  }, {
    '$autoname': 'Favourite_spiece',
    '$kuid': 'zv21a26',
    'required': false,
    'type': 'text',
    'label': ['Favourite spiece']
  }, {
    '$kuid': '/vy2km60',
    'type': 'end_group'
  }, {
    '$autoname': 'Comments',
    '$kuid': 'sm0pu34',
    'required': false,
    'type': 'text',
    'label': ['Comments']
  }
];
