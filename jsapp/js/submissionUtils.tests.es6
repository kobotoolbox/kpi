import {
  complexSurvey,
  complexSurveySubmission
} from 'js/submissionUtils.mocks';
import {
  getSubmissionDisplayData
} from 'js/submissionUtils';

describe('getSubmissionDisplayData', () => {
  it('should return a nested arrays with data suitable for rendering', () => {
      const test = getSubmissionDisplayData(complexSurvey, 0, complexSurveySubmission);
      const target = [
        {
          label: 'Family name',
          name: 'Family_name',
          type: 'text',
          data: 'Smith'
        },
        {
          label: 'People',
          name: 'group_people',
          isRepeat: true,
          children: [
            {
              label: null,
              name: null,
              children: [
                {
                  label: 'Face',
                  name: 'Face',
                  type: 'image',
                  data: '___Carroll Dunham - Bather-15_31_33.jpg'
                },
                {
                  label: 'Person age',
                  name: 'Person_age',
                  type: 'integer',
                  data: '66'
                },
                {
                  label: 'Secret place',
                  name: 'Secret_place',
                  type: 'geopoint',
                  data: '52.48278 18.099317 0 0'
                },
                {
                  label: 'Born date',
                  name: 'Born_date',
                  type: 'date',
                  data: '1990-02-06'
                },
                {
                  label: 'Person name',
                  name: 'Person_name',
                  type: 'text',
                  data: 'John'
                },
                {
                  label: 'Favourites',
                  name: 'group_favourites',
                  children: [
                    {
                      label: 'Food',
                      name: 'Food',
                      type: 'select_multiple',
                      data: 'apple pizza'
                    },
                    {
                      label: 'Colour',
                      name: 'Colour',
                      type: 'select_one',
                      data: 'goldenrod'
                    }
                  ]
                },
                {
                  label: 'Pets',
                  name: 'group_pets',
                  isRepeat: true,
                  children: [
                    {
                      label: null,
                      name: null,
                      children: [
                        {
                          label: 'Pet_name',
                          name: 'Pet_name',
                          type: 'text',
                          data: 'Frank'
                        },
                        {
                          label: 'Pet_age',
                          name: 'Pet_age',
                          type: 'integer',
                          data: '1'
                        }
                      ]
                    },
                    {
                      label: null,
                      name: null,
                      children: [
                        {
                          label: 'Pet_name',
                          name: 'Pet_name',
                          type: 'text',
                          data: 'Zoe'
                        },
                        {
                          label: 'Pet_age',
                          name: 'Pet_age',
                          type: 'integer',
                          data: '6'
                        }
                      ]
                    },
                    {
                      label: null,
                      name: null,
                      children: [
                        {
                          label: 'Pet_name',
                          name: 'Pet_name',
                          type: 'text',
                          data: 'Moe'
                        },
                        {
                          label: 'Pet_age',
                          name: 'Pet_age',
                          type: 'integer',
                          data: '109'
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              label: null,
              name: null,
              children: [
                {
                  label: 'Face',
                  name: 'Face',
                  type: 'image',
                  data: '___Screenshot 2019-05-03 at 17.21.59-15_32_27.png'
                },
                {
                  label: 'Person age',
                  name: 'Person_age',
                  type: 'integer',
                  data: '15'
                },
                {
                  label: 'Secret place',
                  name: 'Secret_place',
                  type: 'geopoint',
                  data: '39.909736 -81.589529 0 0'
                },
                {
                  label: 'Born date',
                  name: 'Born_date',
                  type: 'date',
                  data: '2009-11-25'
                },
                {
                  label: 'Person name',
                  name: 'Person_name',
                  type: 'text',
                  data: 'Sally'
                },
                {
                  label: 'Favourites',
                  name: 'group_favourites',
                  children: [
                    {
                      label: 'Food',
                      name: 'Food',
                      type: 'select_multiple',
                      data: null
                    },
                    {
                      label: 'Colour',
                      name: 'Colour',
                      type: 'select_one',
                      data: 'chocolate'
                    }
                  ]
                },
                {
                  label: 'Pets',
                  name: 'group_pets',
                  isRepeat: true,
                  children: [
                    {
                      label: null,
                      name: null,
                      children: [
                        {
                          label: 'Pet_name',
                          name: 'Pet_name',
                          type: 'text',
                          data: 'Cricket'
                        },
                        {
                          label: 'Pet_age',
                          name: 'Pet_age',
                          type: 'integer',
                          data: '0'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          label: 'Misc questions',
          name: 'group_misc_questions',
          children: [
            {
              label: 'How are you?',
              name: 'How_are_you',
              children: [
                {
                  label: 'Physically',
                  name: 'Physically',
                  type: 'select_one',
                  data: 'good'
                },
                {
                  label: 'Emotionally',
                  name: 'Emotionally',
                  type: 'select_one',
                  data: 'bad'
                }
              ]
            },
            {
              label: 'Show your skills',
              name: null,
              children: [
                {
                  label: '5 and 6',
                  name: 'skills_5_and_6',
                  children: [
                    {
                      label: 'Sum of 5 and 6',
                      name: 'skills_5_and_6_sum',
                      type: 'integer',
                      data: '11'
                    },
                    {
                      label: 'Multiple of 5 and 6',
                      name: 'skills_5_and_6_multiple',
                      type: 'integer',
                      data: '30'
                    }
                  ]
                },
                {
                  label: '1 and 1',
                  name: 'skills_1_and_1',
                  children: [
                    {
                      label: 'Sum of 1 and 1',
                      name: 'skills_1_and_1_sum',
                      type: 'integer',
                      data: '2'
                    },
                    {
                      label: 'Multiple of 1 and 1',
                      name: 'skills_1_and_1_multiple',
                      type: 'integer',
                      data: '1'
                    }
                  ]
                }
              ]
            },
            {
              name: 'Best_things_in_life',
              label: 'Best things in life',
              children: [
                {
                  name: '_1st_choice',
                  type: 'select_one',
                  label: '1st choice',
                  data: 'conquest'
                }, {
                  name: '_2nd_choice',
                  type: 'select_one',
                  label: '2nd choice',
                  data: 'food'
                }, {
                  name: '_3rd_choice',
                  type: 'select_one',
                  label: '3rd choice',
                  data: 'swords'
                }
              ]
            }
          ]
        },
        {
          name: 'Choose_a_range',
          type: 'range',
          label: 'Choose a range',
          data: '3'
        }
      ];
      expect(test).to.deep.equal(target);
  });
});
