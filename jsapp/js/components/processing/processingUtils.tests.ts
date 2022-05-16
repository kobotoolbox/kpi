import chai from 'chai';
import {
  getSupplementalTranscriptPath,
  getSupplementalTranscriptColumnName,
  getSupplementalTranslationPath,
  getSupplementalTranslationColumnName,
} from './processingUtils';

describe('getSupplementalTranscriptPath', () => {
  it('should return proper path', () => {
    const test = getSupplementalTranscriptPath('your_name', 'fr');
    chai.expect(test).to.equal('_supplementalDetails/your_name/transcript/fr');
  });
});

describe('getSupplementalTranscriptColumnName', () => {
  it('should return proper path', () => {
    const test = getSupplementalTranscriptColumnName('your_name', 'fr');
    chai.expect(test).to.equal('your_name/transcript_fr');
  });
});

describe('getSupplementalTranslationPath', () => {
  it('should return proper path', () => {
    const test = getSupplementalTranslationPath('your_name', 'pl');
    chai.expect(test).to.equal('_supplementalDetails/your_name/translated/pl');
  });
});

describe('getSupplementalTranslationColumnName', () => {
  it('should return proper path', () => {
    const test = getSupplementalTranslationColumnName('your_name', 'fr');
    chai.expect(test).to.equal('your_name/translated_fr');
  });
});
