import {
  readParameters,
  writeParameters,
  nullifyTranslations,
  unnullifyTranslations,
} from 'js/components/formBuilder/formBuilderUtils';

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
