import chai from 'chai';
import {
  isAnyProcessingRoute,
  getProcessingRouteParts,
  ProcessingTab,
} from './routes.utils';

describe('processing routes.utils tests', () => {
  describe('getProcessingRouteParts', () => {
    it('should return proper path parts for analysis route', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/analysis';
      const test = getProcessingRouteParts(path);
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Analysis,
      });
    });

    it('should return proper path parts for transcript route with query', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm/transcript?something';
      const test = getProcessingRouteParts(path);
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
        tabName: ProcessingTab.Transcript,
      });
    });

    it('should return proper path parts for processing root route', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm';
      const test = getProcessingRouteParts(path);
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
      });
    });

    it('should return proper path parts for processing root route with query', () => {
      const path = '/forms/abc123/data/processing/My_que/def-45gh-jklm?something';
      const test = getProcessingRouteParts(path);
      chai.expect(test).to.deep.equal({
        assetUid: 'abc123',
        xpath: 'My_que',
        submissionEditId: 'def-45gh-jklm',
      });
    });

    it('should return empty path parts for project non processing route', () => {
      const path = '/forms/abc123/data/table';
      const test = getProcessingRouteParts(path);
      chai.expect(test).to.deep.equal({
        assetUid: '',
        xpath: '',
        submissionEditId: '',
      });
    });

    it('should return empty path parts for non project route', () => {
      const path = '/account/settings';
      const test = getProcessingRouteParts(path);
      chai.expect(test).to.deep.equal({
        assetUid: '',
        xpath: '',
        submissionEditId: '',
      });
    });

    it('should return empty path parts for deep nested non project route', () => {
      const path = '/a/b/c/d/e/f/g/h/i/j/k/l/m';
      const test = getProcessingRouteParts(path);
      chai.expect(test).to.deep.equal({
        assetUid: '',
        xpath: '',
        submissionEditId: '',
      });
    });
  });

  describe('isAnyProcessingRoute', () => {
    const goodCases = [
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/transcript',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/translations',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/analysis',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm?some=params',
      '/forms/abc123/data/processing/My_que/def-45gh-jklm/analysis?some=params&more=of_them',
    ];

    goodCases.forEach((testCase) => {
      it(`should be true for "${testCase}" route`, () => {
        const test = isAnyProcessingRoute(testCase);
        chai.expect(test).to.be.equal(true);
      });
    });

    const badCases = [
      '/account/settings',
      undefined,
      '/forms/abc123/data/table',
    ];

    badCases.forEach((testCase) => {
      it(`should be false for "${testCase}" route`, () => {
        const test = isAnyProcessingRoute(testCase);
        chai.expect(test).to.be.equal(false);
      });
    });
  });
});
