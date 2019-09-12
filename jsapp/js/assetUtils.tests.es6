import {surveyWithGroups} from 'js/assetUtils.mocks';
import {getSurveyFlatPaths} from 'js/assetUtils';

describe('getSurveyFlatPaths', () => {
  it('should return a list of all rows paths', () => {
    const test = getSurveyFlatPaths(surveyWithGroups);
    const target = {
      Your_place: 'Your_place',
      Your_name: 'Your_name',
      When_did_you_eat: 'group_breakfast/When_did_you_eat',
      What_did_you_eat: 'group_breakfast/What_did_you_eat',
      Snack_name: 'group_snacks/Snack_name',
      Time_of_consumption: 'group_snacks/Time_of_consumption',
      How_much_protein_was_it: 'group_snacks/group_nutrients/How_much_protein_was_it',
      How_much_H2O_was_it: 'group_snacks/group_nutrients/How_much_H2O_was_it',
      Favourite_food: 'group_favs/Favourite_food',
      Favourite_fruit: 'group_favs/group_favplant/Favourite_fruit',
      Favourite_carrot: 'group_favs/group_favplant/group_favveg/Favourite_carrot',
      Favourite_potato: 'group_favs/group_favplant/group_favveg/Favourite_potato',
      Favourite_vegan_hummus: 'group_favs/group_favvegan/Favourite_vegan_hummus',
      Favourite_spiece: 'group_favs/Favourite_spiece',
      Comments: 'Comments'
    };
    expect(test).to.deep.equal(target);
  });
});
