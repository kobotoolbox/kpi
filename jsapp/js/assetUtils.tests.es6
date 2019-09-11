import {surveyWithGroups} from 'js/assetUtils.mocks';
import {getQuestionPath} from 'js/assetUtils';

describe('getQuestionPath', () => {
  it('should return all parent groups in a path', () => {
    expect(getQuestionPath('Your_place', surveyWithGroups)).to.equal('Your_place');
    expect(getQuestionPath('Your_name', surveyWithGroups)).to.equal('Your_name');
    expect(getQuestionPath('When_did_you_eat', surveyWithGroups)).to.equal('group_breakfast/When_did_you_eat');
    expect(getQuestionPath('What_did_you_eat', surveyWithGroups)).to.equal('group_breakfast/What_did_you_eat');
    expect(getQuestionPath('Snack_name', surveyWithGroups)).to.equal('group_snacks/Snack_name');
    expect(getQuestionPath('Time_of_consumption', surveyWithGroups)).to.equal('group_snacks/Time_of_consumption');
    expect(getQuestionPath('How_much_protein_was_it', surveyWithGroups)).to.equal('group_snacks/group_nutrients/How_much_protein_was_it');
    expect(getQuestionPath('How_much_H2O_was_it', surveyWithGroups)).to.equal('group_snacks/group_nutrients/How_much_H2O_was_it');
    expect(getQuestionPath('group_favs', surveyWithGroups)).to.equal('group_favs');
    expect(getQuestionPath('Favourite_food', surveyWithGroups)).to.equal('group_favs/Favourite_food');
    expect(getQuestionPath('Favourite_fruit', surveyWithGroups)).to.equal('group_favs/group_favplant/Favourite_fruit');
    expect(getQuestionPath('Favourite_carrot', surveyWithGroups)).to.equal('group_favs/group_favplant/group_favveg/Favourite_carrot');
    expect(getQuestionPath('Favourite_carrot', surveyWithGroups)).to.equal('group_favs/group_favplant/group_favveg/Favourite_potato');
    expect(getQuestionPath('Favourite_vegan_hummus', surveyWithGroups)).to.equal('group_favs/group_favvegan/Favourite_vegan_hummus');
    expect(getQuestionPath('Favourite_spiece', surveyWithGroups)).to.equal('group_favs/Favourite_spiece');
    expect(getQuestionPath('Comments', surveyWithGroups)).to.equal('Comments');
  });
});
