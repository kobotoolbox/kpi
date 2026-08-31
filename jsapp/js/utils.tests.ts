import {
  formatSeconds,
  formatTimeFromSeconds,
  generateAutoname,
  getLangAsObject,
  getLangString,
  getSubmissionRootUuid,
  join,
  truncateFile,
  truncateString,
  truncateUrl,
} from '#/utils'

describe('utils', () => {
  describe('join', () => {
    it('should make an array with separators between array elements', () => {
      const testCases: Array<Array<any>> = [
        [['hi', 'hello', 'how are you'], '<br/>', ['hi', '<br/>', 'hello', '<br/>', 'how are you']],
        [['a', 'b', 'c'], '\n', ['a', '\n', 'b', '\n', 'c']],
        [[1, 2, 3], 0, [1, 0, 2, 0, 3]],
        [['a', 2, { hello: 'world' }], [], ['a', [], 2, [], { hello: 'world' }]],
        // We could add a real JSX test case here (we'd have to import React)
      ]

      testCases.forEach((testCase) => {
        const test = join(testCase[0], testCase[1])
        chai.expect(test).to.deep.equal(testCase[2])
      })
    })
  })

  describe('formatSeconds', () => {
    it('should format properly', () => {
      const testCases: [number, string][] = [
        [10, '00:00:10'],
        [0, '00:00:00'],
        [1.333, '00:00:01'],
        [1.777, '00:00:02'],
        [60, '00:01:00'],
        [671, '00:11:11'],
        [1111, '00:18:31'],
        [3599, '00:59:59'],
        [6000, '01:40:00'],
        [6666, '01:51:06'],
      ]
      testCases.forEach((testCase) => {
        const test = formatSeconds(testCase[0])
        chai.expect(test).to.equal(testCase[1])
      })
    })
  })

  describe('getLangAsObject', () => {
    it('should return object for valid langString', () => {
      const langObj = getLangAsObject('English (en)')
      chai.expect(langObj?.name).to.equal('English')
      chai.expect(langObj?.code).to.equal('en')
    })

    it('should return undefined for invalid langString', () => {
      chai.expect(getLangAsObject('English')).to.equal(undefined)
      chai.expect(getLangAsObject('(en)')).to.equal(undefined)
      chai.expect(getLangAsObject('English [en]')).to.equal(undefined)
      chai.expect(getLangAsObject('English, en')).to.equal(undefined)
      chai.expect(getLangAsObject('English: en')).to.equal(undefined)
      chai.expect(getLangAsObject('(en) English')).to.equal(undefined)
      chai.expect(getLangAsObject('English (en) (fr) (de)')).to.equal(undefined)
      chai.expect(getLangAsObject('Pizza time!')).to.equal(undefined)
    })

    it('should work properly with getLangString', () => {
      const langString = getLangString({
        name: 'English',
        code: 'en',
      })
      const langObj = getLangAsObject(langString || '')
      chai.expect(langObj?.name).to.equal('English')
      chai.expect(langObj?.code).to.equal('en')
    })
  })

  describe('getLangString', () => {
    it('should return valid langString from langObj', () => {
      const langString = getLangString({
        name: 'English',
        code: 'en',
      })
      chai.expect(langString).to.equal('English (en)')
    })

    // TODO: remove this test when all code is migrated to TS
    it('should return nothing for invalid object', () => {
      const langString = getLangString({
        pizzaType: 2,
        delivery: false,
      } as any)
      chai.expect(langString).to.equal(undefined)
    })

    it('should work properly with getLangAsObject', () => {
      const langObj = getLangAsObject('English (en)')
      const langString = langObj ? getLangString(langObj) : ''
      chai.expect(langString).to.equal('English (en)')
    })
  })

  describe('truncateString, truncateUrl, truncateFile', () => {
    it('should not truncate strings shorter than specified length', () => {
      const testString = 'veryShortString'
      const testLength = 1000
      chai.expect(truncateString(testString, testLength)).to.equal(testString)
    })

    it('should not apply extension truncation to when there is no extension', () => {
      const testString = 'veryShortString'
      const testLength = 1000
      chai.expect(truncateFile(testString, testLength)).to.equal(testString)
    })

    it('should not apply protocol truncation to when there is no protocol', () => {
      const testString = 'veryShortString'
      const testLength = 1000
      chai.expect(truncateUrl(testString, testLength)).to.equal(testString)
    })

    it('should return exactly `length` characters', () => {
      const testString = 'veryShortString'
      const testLength = 5
      chai.expect(truncateString(testString, testLength).length).to.equal(testLength)
    })

    it('should remove extensions if specified', () => {
      const testString = 'veryShortString.xml'
      const testLength = 10
      chai.expect(truncateFile(testString, testLength)).to.equal('veryS…tring')
    })

    it('should remove protocols if specified', () => {
      const testString = 'http://veryShortString.com'
      const testLength = 10
      chai.expect(truncateUrl(testString, testLength)).to.equal('veryS…g.com')
    })

    it('should impose its type specific truncation regardless of content', () => {
      const testString = 'http://veryShortString.com'
      const testLength = 10
      chai.expect(truncateFile(testString, testLength)).to.equal('http:…tring')
    })
  })

  describe('generateAutoname', () => {
    it('should use default values if only string is specified', () => {
      const testString = 'veryShortString'
      chai.expect(generateAutoname(testString)).to.equal('veryshortstring')
    })

    it('should create a proper substring', () => {
      const testString = 'veryShortString'
      const INDEX_FIRST_WORD = 4
      const INDEX_LAST_WORD = 9
      chai.expect(generateAutoname(testString, INDEX_FIRST_WORD, INDEX_LAST_WORD)).to.equal('short')
    })

    it('should change all spaces to underscores', () => {
      const testString = 'i am   a very long na   me with  weird s      paces'
      chai
        // TODO: See if backend uses single or multiple underscores for spaces
        .expect(generateAutoname(testString))
        .to.equal('i_am___a_very_long_na___me_with__weird_s______paces')
    })

    it('should create a proper substring and change all spaces to underscores', () => {
      const testString = 'i am   a very long na   me with  weird s      paces'
      const INDEX_FIRST_WORD = 4
      const INDEX_LAST_WORD = 21
      chai.expect(generateAutoname(testString, INDEX_FIRST_WORD, INDEX_LAST_WORD)).to.equal('___a_very_long_na')
    })
  })

  describe('formatTimeFromSeconds', () => {
    it('formats hours only', () => {
      const result = formatTimeFromSeconds(7200)
      chai.expect(result).to.deep.equal('2 hours')
    })

    it('formats minutes only', () => {
      const result = formatTimeFromSeconds(3540)
      chai.expect(result).to.deep.equal('59 minutes')
    })

    it('formats seconds only', () => {
      const result = formatTimeFromSeconds(59)
      chai.expect(result).to.deep.equal('59 seconds')
    })

    it('formats hours and minutes', () => {
      const result = formatTimeFromSeconds(7500)
      chai.expect(result).to.deep.equal('2 hours, 5 minutes')
    })

    it('handles zero in seconds', () => {
      const result = formatTimeFromSeconds(0)
      chai.expect(result).to.deep.equal('0 seconds')
    })

    it('rounds seconds down to nearest minute if number is more than 60', () => {
      const result = formatTimeFromSeconds(61)
      chai.expect(result).to.deep.equal('1 minutes')
    })

    it('rounds seconds down to nearest minute if number is more than 3600 (an hour)', () => {
      const result = formatTimeFromSeconds(3601)
      chai.expect(result).to.deep.equal('1 hours')
    })
  })

  describe('getSubmissionRootUuid', () => {
    it('should strip the default prefix off the root uuid', () => {
      const test = getSubmissionRootUuid({ _uuid: 'some-uuid', 'meta/rootUuid': 'uuid:some-uuid' })
      chai.expect(test).to.equal('some-uuid')
    })

    it('should prefer the root uuid over the current uuid', () => {
      const test = getSubmissionRootUuid({ _uuid: 'edited-uuid', 'meta/rootUuid': 'uuid:original-uuid' })
      chai.expect(test).to.equal('original-uuid')
    })

    // An empty string counts as missing too - the back end omits the field rather than blanking it, but a blank would
    // otherwise sail through and be sent as an id.
    it('should fall back to the uuid when there is no root uuid', () => {
      chai.expect(getSubmissionRootUuid({ _uuid: 'some-uuid' })).to.equal('some-uuid')
      chai.expect(getSubmissionRootUuid({ _uuid: 'some-uuid', 'meta/rootUuid': '' })).to.equal('some-uuid')
    })

    // OpenRosa allows custom namespaces to avoid uuid collisions, so stripping one could point at a different
    // submission entirely.
    it('should preserve a custom prefix', () => {
      const test = getSubmissionRootUuid({ _uuid: 'some-uuid', 'meta/rootUuid': 'kobotoolbox.org:some-uuid' })
      chai.expect(test).to.equal('kobotoolbox.org:some-uuid')
    })
  })
})
