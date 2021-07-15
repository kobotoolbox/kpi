import {
  readParameters,
  writeParameters,
  getLangAsObject,
  getLangString,
  nullifyTranslations,
  unnullifyTranslations,
  truncateString,
  truncateUrl,
  truncateFile,
  generateAutoname,
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

//  TRANSLATIONS HACK tests

describe('translations hack', () => {
  describe('nullifyTranslations', () => {
    it('should return array with null for no translations', () => {
      const test = {
        survey: [{
          'label': ['Hello']
        }]
      };
      const target = {
        survey: [{'label': ['Hello']}],
        translations: [null]
      }
      expect(
        nullifyTranslations(test.translations, test.translated, test.survey, test.baseSurvey)
      ).to.deep.equal(target);
    });

    it('should throw if there are unnamed translations', () => {
      const test = {
        survey: [{
          'label': ['Hello']}
        ],
        translations: [
          null,
          'English (en)'
        ]
      };
      expect(() => {
        nullifyTranslations(test.translations, test.translated, test.survey, test.baseSurvey);
      }).to.throw();
    });

    it('should not reorder anything if survey has same default language as base survey', () => {
      const test = {
        baseSurvey: {_initialParams: {translations_0: 'English (en)'}},
        survey: [{
          'label': [
            'Hello',
            'Cześć'
          ]
        }],
        translations: [
          'English (en)',
          'Polski (pl)'
        ],
        translated: [
          'label'
        ]
      };
      const target = {
        survey: [{
          'label': [
            'Hello',
            'Cześć'
          ]
        }],
        translations: [
          null,
          'Polski (pl)'
        ],
        translations_0: 'English (en)'
      }
      expect(
        nullifyTranslations(test.translations, test.translated, test.survey, test.baseSurvey)
      ).to.deep.equal(target);
    });

    it('should reorder translated props if survey has same default language as base survey but in different order', () => {
      const test = {
        baseSurvey: {_initialParams: {translations_0: 'English (en)'}},
        survey: [{
          'label': [
            'Allo',
            'Cześć',
            'Hello'
          ]
        }],
        translations: [
          'Francais (fr)',
          'Polski (pl)',
          'English (en)'
        ],
        translated: [
          'label'
        ]
      };
      const target = {
        survey: [{
          'label': [
            'Hello' ,
            'Allo',
            'Cześć'
          ]
        }],
        translations: [
          null,
          'Francais (fr)',
          'Polski (pl)'
        ],
        translations_0: 'English (en)'
      }
      expect(
        nullifyTranslations(test.translations, test.translated, test.survey, test.baseSurvey)
      ).to.deep.equal(target);
    });

    it('should add base survey\'s default language if survey doesn\'t have it', () => {
      const test = {
        baseSurvey: {_initialParams: {translations_0: 'English (en)'}},
        survey: [{
          'label': [
            'Allo',
            'Cześć'
          ],
          name: 'welcome_message'
        }],
        translations: [
          'Francais (fr)',
          'Polski (pl)'
        ],
        translated: [
          'label'
        ]
      };
      const target = {
        survey: [{
          'label': [
            'welcome_message',
            'Allo',
            'Cześć'
          ],
          name: 'welcome_message'
        }],
        translations: [
          null,
          'Francais (fr)',
          'Polski (pl)'
        ],
        translations_0: 'English (en)'
      }
      expect(
        nullifyTranslations(test.translations, test.translated, test.survey, test.baseSurvey)
      ).to.deep.equal(target);
    });

    it('should add null language if base survey has no translations but survey does', () => {
      const test = {
        baseSurvey: {_initialParams: {}},
        survey: [{
          'label': [
            'Allo',
            'Cześć'
          ],
          name: 'welcome_message'
        }],
        translations: [
          'Francais (fr)',
          'Polski (pl)'
        ],
        translated: [
          'label'
        ]
      };
      const target = {
        survey: [{
          'label': [
            'welcome_message',
            'Allo',
            'Cześć'
          ],
          name: 'welcome_message'
        }],
        translations: [
          null,
          'Francais (fr)',
          'Polski (pl)'
        ]
      }
      expect(
        nullifyTranslations(test.translations, test.translated, test.survey, test.baseSurvey)
      ).to.deep.equal(target);
    });

    it('should do nothing if neither base survey nor survey have translations', () => {
      const test = {
        baseSurvey: {_initialParams: {}},
        survey: [{
          'label': ['Hello']
        }],
        translations: [
          null
        ],
        translated: []
      };
      const target = {
        survey: [{
          'label': ['Hello']
        }],
        translations: [
          null
        ]
      }
      expect(
        nullifyTranslations(test.translations, test.translated, test.survey, test.baseSurvey)
      ).to.deep.equal(target);
    });
  });

  describe('unnullifyTranslations', () => {
    it('should set default language if it\'s not set already', () => {
      const test = {
        surveyDataJSON: JSON.stringify({
          survey: [
            {
              label: 'Cheese?'
            }
          ],
          settings: [
            {}
          ]
        }),
        assetContent: {
          translated: ['label'],
          translations_0: 'English (en)'
        },
      };
      const target = JSON.stringify({
        survey: [
          {
            'label::English (en)': 'Cheese?'
          }
        ],
        settings: [
          {
            default_language: 'English (en)'
          }
        ]
      });
      expect(
        unnullifyTranslations(test.surveyDataJSON, test.assetContent)
      ).to.deep.equal(target);
    });

    it('should replace nullified props with translated ones', () => {
      const test = {
        surveyDataJSON: JSON.stringify({
          survey: [
            {
              label: 'Cheese?',
              'label::Polski (pl)': 'Ser?'
            }
          ],
          choices: [
            {
              label: 'Yes'
            },
            {
              label: 'No',
              'label::Polski (pl)': 'Nie'
            }
          ],
          settings: [
            {
              default_language: 'English (en)'
            }
          ]
        }),
        assetContent: {
          translated: ['label'],
          translations_0: 'English (en)'
        },
      };
      const target = JSON.stringify({
        survey: [
          {
            'label::Polski (pl)': 'Ser?',
            'label::English (en)': 'Cheese?'
          }
        ],
        choices: [
          {
            'label::English (en)': 'Yes'
          },
          {
            'label::Polski (pl)': 'Nie',
            'label::English (en)': 'No'
          }
        ],
        settings: [
          {
            default_language: 'English (en)'
          }
        ]
      });
      expect(
        unnullifyTranslations(test.surveyDataJSON, test.assetContent)
      ).to.deep.equal(target);
    });
  });
});

describe('readParameters', () => {
  const validReadPairs = [
    {
      str:'foo=',
      obj: {foo: ''},
      note: 'empty parameter'
    },
    {
      str:'foo=;bar=1;fum=;baz=',
      obj: {foo: '', bar: '1', fum: '', baz: ''},
      note: 'empty parameters'
    },
    {
      str:'foo=bar',
      obj: {foo: 'bar'},
      note: 'single parameter'
    },
    {
      str:'foo=1 bar=10 fum=1',
      obj: {foo: '1', bar: '10', fum: '1'},
      note: 'space-separated parameters'
    },
    {
      str:'foo=1,bar=10,fum=1',
      obj: {foo: '1', bar: '10', fum: '1'},
      note: 'comma-separated parameters'
    },
    {
      str:'foo=1;bar=10;fum=1',
      obj: {foo: '1', bar: '10', fum: '1'},
      note: 'semicolon-separated parameters'
    },
    {
      str:'foo  = 1    bar  =  10    fum  =  1',
      obj: {foo: '1', bar: '10', fum: '1'},
      note: 'space-dirty space-separated parameters'
    },
    {
      str:'foo = 1 , bar = 10 , fum = 1',
      obj: {foo: '1', bar: '10', fum: '1'},
      note: 'space-dirty comma-separated parameters'
    },
    {
      str:'foo = 1  ; bar = 10 ; fum = 1',
      obj: {foo: '1', bar: '10', fum: '1'},
      note: 'space-dirty semicolon-separated parameters'
    },
    {
      str:'foo=1 bar=10,fum=1;baz=0',
      obj: {foo: '1 bar=10,fum=1', baz: '0'},
      note: 'parameters with mixed separators'
    },
    {
      str:'foo    =2',
      obj: {foo: '2'},
      note: 'left-space-dirty single parameter'
    },
    {
      str:'foo     =   2',
      obj: {foo: '2'},
      note: 'both-space-dirty single parameter'
    },
    {
      str:'foo=      2',
      obj: {foo: '2'},
      note: 'right-space-dirty single parameter'
    },
    {
      str:'foo = 2, 4  ; bar =  4 , , 4 a   ,  ; fum=baz',
      obj: {foo: '2, 4', bar: '4 , , 4 a', fum: 'baz'},
      note: 'dirty parameters with mixed separators'
    },
  ];

  validReadPairs.forEach((pair) => {
    it(`should return valid object from ${pair.note}`, () => {
      chai.expect(readParameters(pair.str)).to.deep.equal(pair.obj);
    });
  });

  it('should read parameters values as strings', () => {
    const obj = readParameters('foo=1;bar=false;fum=0.5;baz=[1,2,3]');
    chai.expect(typeof obj.foo).to.equal('string');
    chai.expect(typeof obj.bar).to.equal('string');
    chai.expect(typeof obj.fum).to.equal('string');
    chai.expect(typeof obj.baz).to.equal('string');
  });

  it('should return null for invalid parameter string', () => {
    chai.expect(readParameters('abc:1')).to.equal(null);
    chai.expect(readParameters('1')).to.equal(null);
    chai.expect(readParameters('')).to.equal(null);
    chai.expect(readParameters(0)).to.equal(null);
    chai.expect(readParameters(false)).to.equal(null);
    chai.expect(readParameters(null)).to.equal(null);
    chai.expect(readParameters(undefined)).to.equal(null);
    chai.expect(readParameters({})).to.equal(null);
    chai.expect(readParameters([])).to.equal(null);
  });
});

describe('writeParameters', () => {
  const validWritePairs = [
    {
      str: 'foo=1;bar=10;fum=1',
      obj: {foo: '1', bar: '10', fum: '1'},
      note: 'valid string from object with multiple parameters'
    },
    {
      str: 'foo=2',
      obj: {foo: '2'},
      note: 'valid string from object with single parameter'
    },
    {
      str: 'bar=0;baz=false',
      obj: {foo: null, bar: 0, fum: undefined, baz: false},
      note: 'valid string omitting empty values from object with multiple parameters'
    },
    {
      str: 'foo={"bar":"a","fum":{"baz":"b"}}',
      obj: {foo: {bar: 'a', fum: {baz: 'b'}}},
      note: 'valid string from nested object'
    },
  ];

  validWritePairs.forEach((pair) => {
    it(`should return ${pair.note}`, () => {
      chai.expect(writeParameters(pair.obj)).to.equal(pair.str);
    });
  });
});
