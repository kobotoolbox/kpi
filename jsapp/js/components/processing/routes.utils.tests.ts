import chai from 'chai'
import { ProcessingTab, getProcessingRouteParts, isAnyProcessingRoute } from './routes.utils'

describe('processing routes.utils tests', () => {
  describe('getProcessingRouteParts', () => {
    it('should return proper path parts for analysis route', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/analysis'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Analysis,
      })
    })

    it('should return proper path parts for transcript route with query', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/transcript?something'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Transcript,
      })
    })

    it('should return proper path parts for processing root route', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
      })
    })

    it('should return proper path parts for processing root route with query', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm?something'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
      })
    })

    it('should return empty path parts for project non processing route', () => {
      const path = '/forms/abc123/data/table'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: '',
        xpath: '',
        submissionEditId: '',
      })
    })

    it('should return empty path parts for non project route', () => {
      const path = '/account/settings'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: '',
        xpath: '',
        submissionEditId: '',
      })
    })

    it('should return empty path parts for deep nested non project route', () => {
      const path = '/a/b/c/d/e/f/g/h/i/j/k/l/m'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: '',
        xpath: '',
        submissionEditId: '',
      })
    })
  })

  describe('isAnyProcessingRoute', () => {
    const goodCases = [
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/transcript',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/translations',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/analysis',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm?some=params',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/analysis?some=params&more=of_them',
    ]

    goodCases.forEach((testCase) => {
      it(`should be true for "${testCase}" route`, () => {
        const test = isAnyProcessingRoute(testCase)
        chai.expect(test).to.be.equal(true)
      })
    })

    const badCases = ['/account/settings', undefined, '/forms/abc123/data/table']

    badCases.forEach((testCase) => {
      it(`should be false for "${testCase}" route`, () => {
        const test = isAnyProcessingRoute(testCase)
        chai.expect(test).to.be.equal(false)
      })
    })
  })

  describe('getProcessingRouteParts with languageCode', () => {
    it('should return languageCode for translation detail route', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/translations/es'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Translations,
        languageCode: 'es',
      })
    })

    it('should return languageCode for translation detail route with query', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/translations/fr?something'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Translations,
        languageCode: 'fr',
      })
    })

    it('should not have languageCode for translations route without language', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/translations'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Translations,
      })
      chai.expect(test.languageCode).to.be.undefined
    })

    it('should not have languageCode for transcript route', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/transcript'
      const test = getProcessingRouteParts(path)
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Transcript,
      })
      chai.expect(test.languageCode).to.be.undefined
    })
  })

  // Note: goToProcessing tests would require mocking the router which is complex in this test environment.
  // We'll test the path generation logic through getProcessingRouteParts tests instead.

  describe('isAnyProcessingRoute with languageCode', () => {
    it('should recognize translation detail routes with languageCode', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/translations/es'
      const test = isAnyProcessingRoute(path)
      chai.expect(test).to.be.equal(true)
    })

    it('should recognize translation detail routes with languageCode and query', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/translations/fr?some=params'
      const test = isAnyProcessingRoute(path)
      chai.expect(test).to.be.equal(true)
    })
  })
})
