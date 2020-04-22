import {
  surveyWithGroups,
  surveyWithAllPossibleGroups
} from 'js/assetUtils.mocks';
import {getSurveyFlatPaths} from 'js/assetUtils';

describe('getSurveyFlatPaths', () => {
  it('should return a list of paths for all questions', () => {
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

  it('should work with all possible group types', () => {
    const test = getSurveyFlatPaths(surveyWithAllPossibleGroups);
    const target = {
      'First_name': 'group_people/First_name',
      'Original_location': 'group_location/Original_location',
      'Current_location': 'group_location/Current_location',
      'Killing_humans': 'Are_you_vegan/Killing_humans',
      'Killing_nonhumans': 'Are_you_vegan/Killing_nonhumans',
      '_1st_choice': 'Best_things_in_life/_1st_choice',
      '_2nd_choice': 'Best_things_in_life/_2nd_choice',
      '_3rd_choice': 'Best_things_in_life/_3rd_choice',
      'human': 'group_crossbreeding/human',
      'nonhuman': 'group_crossbreeding/nonhuman',
    };
    expect(test).to.deep.equal(target);
  });

  it('should work with all possible group types with groups included', () => {
    const test = getSurveyFlatPaths(surveyWithAllPossibleGroups, true);
    const target = {
      'group_people': 'group_people',
      'First_name': 'group_people/First_name',
      'group_location': 'group_location',
      'Original_location': 'group_location/Original_location',
      'Current_location': 'group_location/Current_location',
      'Are_you_vegan': 'Are_you_vegan',
      'Killing_humans': 'Are_you_vegan/Killing_humans',
      'Killing_nonhumans': 'Are_you_vegan/Killing_nonhumans',
      'Best_things_in_life': 'Best_things_in_life',
      '_1st_choice': 'Best_things_in_life/_1st_choice',
      '_2nd_choice': 'Best_things_in_life/_2nd_choice',
      '_3rd_choice': 'Best_things_in_life/_3rd_choice',
      'group_crossbreeding': 'group_crossbreeding',
      'human': 'group_crossbreeding/human',
      'nonhuman': 'group_crossbreeding/nonhuman',
    };
    expect(test).to.deep.equal(target);
  });

  it('should include groups in the output if asked to', () => {
    const test = getSurveyFlatPaths(surveyWithGroups, true);
    const target = {
      Your_place: 'Your_place',
      Your_name: 'Your_name',
      group_breakfast: 'group_breakfast',
      When_did_you_eat: 'group_breakfast/When_did_you_eat',
      What_did_you_eat: 'group_breakfast/What_did_you_eat',
      group_snacks: 'group_snacks',
      Snack_name: 'group_snacks/Snack_name',
      Time_of_consumption: 'group_snacks/Time_of_consumption',
      group_nutrients: 'group_snacks/group_nutrients',
      How_much_protein_was_it: 'group_snacks/group_nutrients/How_much_protein_was_it',
      How_much_H2O_was_it: 'group_snacks/group_nutrients/How_much_H2O_was_it',
      group_favs: 'group_favs',
      Favourite_food: 'group_favs/Favourite_food',
      group_favplant: 'group_favs/group_favplant',
      Favourite_fruit: 'group_favs/group_favplant/Favourite_fruit',
      group_favveg: 'group_favs/group_favplant/group_favveg',
      Favourite_carrot: 'group_favs/group_favplant/group_favveg/Favourite_carrot',
      Favourite_potato: 'group_favs/group_favplant/group_favveg/Favourite_potato',
      group_favvegan: 'group_favs/group_favvegan',
      Favourite_vegan_hummus: 'group_favs/group_favvegan/Favourite_vegan_hummus',
      Favourite_spiece: 'group_favs/Favourite_spiece',
      Comments: 'Comments'
    };
    expect(test).to.deep.equal(target);
  });
});
