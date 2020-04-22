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

export const surveyWithAllPossibleGroups = [{
  'name': 'start',
  'type': 'start',
  '$kuid': 'yIzTq1EhT',
  '$autoname': 'start'
}, {
  'name': 'end',
  'type': 'end',
  '$kuid': 'vrOUh8w2q',
  '$autoname': 'end'
}, {
  'name': 'today',
  'type': 'today',
  '$kuid': 'eXoXxQQNi',
  '$autoname': 'today'
}, {
  'name': 'username',
  'type': 'username',
  '$kuid': 'plYTFwZ63',
  '$autoname': 'username'
}, {
  'name': 'simserial',
  'type': 'simserial',
  '$kuid': 'cDTRJ5D78',
  '$autoname': 'simserial'
}, {
  'name': 'subscriberid',
  'type': 'subscriberid',
  '$kuid': 'Nt06yZ7th',
  '$autoname': 'subscriberid'
}, {
  'name': 'deviceid',
  'type': 'deviceid',
  '$kuid': '1W3n5pkGF',
  '$autoname': 'deviceid'
}, {
  'name': 'phonenumber',
  'type': 'phonenumber',
  '$kuid': 'GFKDd8m18',
  '$autoname': 'phonenumber'
}, {
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
