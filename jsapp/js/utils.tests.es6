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

    it('should return undefined for invalid langString', () => {
      chai.expect(getLangAsObject('English')).to.equal(undefined);
      chai.expect(getLangAsObject('(en)')).to.equal(undefined);
      chai.expect(getLangAsObject('English [en]')).to.equal(undefined);
      chai.expect(getLangAsObject('English, en')).to.equal(undefined);
      chai.expect(getLangAsObject('English: en')).to.equal(undefined);
      chai.expect(getLangAsObject('(en) English')).to.equal(undefined);
      chai.expect(getLangAsObject('English (en) (fr) (de)')).to.equal(undefined);
      chai.expect(getLangAsObject('Pizza time!')).to.equal(undefined);
    });

    it('should work properly with getLangString', () => {
      const langObj = getLangAsObject(getLangString({
        name: 'English',
        code: 'en'
      }));
      chai.expect(langObj.name).to.equal('English');
      chai.expect(langObj.code).to.equal('en');
    });
  });

  describe('getLangString', () => {
    it('should return valid langString from langObj', () => {
      const langString = getLangString({
        name: 'English',
        code: 'en'
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

    it('should work properly with getLangAsObject', () => {
      const langString = getLangString(getLangAsObject('English (en)'));
      chai.expect(langString).to.equal('English (en)');
    });
  });
});
