import {
  getLangAsObject,
  getLangString
} from 'utils';

describe('utils', () => {
  describe('getLangAsObject', () => {
    it('should return object for valid langString', () => {
      const langObj = getLangAsObject('English (en)');
      chai.expect(langObj.name).to.equal('English');
      chai.expect(langObj.code).to.equal('en');
    });
  });

  describe('getLangString', () => {
    it('should return valid langString from langObj', () => {
      const langString = getLangString({
        languageName: 'English',
        languageCode: 'en'
      });
      chai.expect(langString).to.equal('English (en)');
    });

    it('should return nothing for invalid object', () => {
      const langString = getLangString({
        pizzaType: 2,
        delivery: false
      });
      chai.expect(langString).to.equal(undefined);
    });
  });
});
