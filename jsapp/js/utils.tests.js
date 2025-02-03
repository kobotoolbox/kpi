import {
  getLangAsObject,
  getLangString,
  truncateString,
  truncateUrl,
  truncateFile,
  generateAutoname,
  formatSeconds,
  join,
} from 'utils';

describe('utils', () => {

  describe('join', () => {
    it('should make an array with separators between array elements', () => {
      [
        [['hi', 'hello', 'how are you'], '<br/>',
          ['hi', '<br/>', 'hello', '<br/>', 'how are you'],
        ],
        [['a', 'b', 'c'], '\n',
          ['a', '\n', 'b', '\n', 'c'],
        ],
        [[1, 2, 3], 0, [1, 0, 2, 0, 3]],
        [['a', 2, {hello: 'world'}], [], ['a', [], 2, [], {hello: 'world'}]],
        // We could add a real JSX test case here (we'd have to import React)
      ].forEach((testCase) => {
        const test = join(testCase[0], testCase[1]);
        chai.expect(test).to.deep.equal(testCase[2]);
      });
    });
  });

  describe('formatSeconds', () => {
    it('should format properly', () => {
      [
        [10, '00:10'],
        [0, '00:00'],
        [1.333, '00:01'],
        [1.777, '00:02'],
        [60, '01:00'],
        [671, '11:11'],
        [1111, '18:31'],
        [3599, '59:59'],
        [6000, '100:00'],
        [6666, '111:06'],
      ].forEach((testCase) => {
        const test = formatSeconds(testCase[0]);
        chai.expect(test).to.equal(testCase[1]);
      });
    });
  });

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

  describe("truncateString, truncateUrl, truncateFile", () => {
    it("should not truncate strings shorter than specified length", () => {
      const testString = "veryShortString";
      const testLength = 1000;
      chai.expect(truncateString(testString, testLength)).to.equal(testString);
    });

    it("should not apply extension truncation to when there is no extension", () => {
      const testString = "veryShortString";
      const testLength = 1000;
      chai
        .expect(truncateFile(testString, testLength))
        .to.equal(testString);
    });

    it("should not apply protocol truncation to when there is no protocol", () => {
      const testString = "veryShortString";
      const testLength = 1000;
      chai
        .expect(truncateUrl(testString, testLength))
        .to.equal(testString);
    });

    it("should return exactly `length` characters", () => {
      const testString = "veryShortString";
      const testLength = 5;
      chai
        .expect(truncateString(testString, testLength).length)
        .to.equal(testLength);
    });

    it("should remove extensions if specified", () => {
      const testString = "veryShortString.xml";
      const testLength = 10;
      chai
        .expect(truncateFile(testString, testLength))
        .to.equal("veryS…tring");
    });

    it("should remove protocols if specified", () => {
      const testString = "http://veryShortString.com";
      const testLength = 10;
      chai
        .expect(truncateUrl(testString, testLength))
        .to.equal("veryS…g.com");
    });

    it("should impose its type specific truncation regardless of content", () => {
      const testString = "http://veryShortString.com";
      const testLength = 10;
      chai
        .expect(truncateFile(testString, testLength))
        .to.equal("http:…tring");
    });
  });

  describe("generateAutoname", () => {
    it("should use default values if only string is specified", () => {
      const testString = "veryShortString";
      chai.expect(generateAutoname(testString)).to.equal("veryshortstring");
    });

    it("should create a proper substring", () => {
      const testString = "veryShortString";
      const INDEX_FIRST_WORD = 4;
      const INDEX_LAST_WORD = 9;
      chai
        .expect(generateAutoname(testString, INDEX_FIRST_WORD, INDEX_LAST_WORD))
        .to.equal("short");
    });

    it("should change all spaces to underscores", () => {
      const testString = "i am   a very long na   me with  weird s      paces";
      chai
        // TODO: See if backend uses single or multiple underscores for spaces
        .expect(generateAutoname(testString))
        .to.equal("i_am___a_very_long_na___me_with__weird_s______paces");
    });

    it("should create a proper substring and change all spaces to underscores", () => {
      const testString = "i am   a very long na   me with  weird s      paces";
      const INDEX_FIRST_WORD = 4;
      const INDEX_LAST_WORD = 21;
      chai
        .expect(generateAutoname(testString, INDEX_FIRST_WORD, INDEX_LAST_WORD))
        .to.equal("___a_very_long_na");
    });
  });
});
