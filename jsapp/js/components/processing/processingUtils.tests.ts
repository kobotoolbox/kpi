import chai from 'chai';
import {
  getSupplementalTranscriptPath,
  getSupplementalTranslationPath,
  getSupplementalPathParts,
} from './processingUtils';

describe('getSupplementalTranscriptPath', () => {
  it('should return proper path', () => {
    const test = getSupplementalTranscriptPath('your_name', 'fr');
    chai.expect(test).to.equal('_supplementalDetails/your_name/transcript_fr');
  });
});

describe('getSupplementalTranslationPath', () => {
  it('should return proper path', () => {
    const test = getSupplementalTranslationPath('your_name', 'pl');
    chai.expect(test).to.equal('_supplementalDetails/your_name/translated_pl');
  });
});

describe('getSupplementalPathParts', () => {
  it('should return proper path', () => {
    const path = getSupplementalTranslationPath('your_name', 'pl');
    const test = getSupplementalPathParts(path);
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      isTranscript: false,
      isTranslation: true,
      languageCode: 'pl',
    });
  });
});
