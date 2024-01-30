import chai from 'chai';
import {getSupplementalPathParts} from './processingUtils';

describe('getSupplementalPathParts', () => {
  it('should return proper path parts for transcript', () => {
    const path = '_supplementalDetails/your_name/transcript_de';
    const test = getSupplementalPathParts(path);
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      type: 'transcript',
      languageCode: 'de',
    });
  });

  it('should return proper path parts for translation', () => {
    const path = '_supplementalDetails/your_name/translation_pl';
    const test = getSupplementalPathParts(path);
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      type: 'translation',
      languageCode: 'pl',
    });
  });

  it('should return proper path parts for analysis question', () => {
    const path = '_supplementalDetails/your_name/a1234567-a123-123a-12a3-123aaaa45678';
    const test = getSupplementalPathParts(path);
    chai.expect(test).to.deep.equal({
      sourceRowName: 'your_name',
      type: 'qual',
      analysisQuestionUuid: 'a1234567-a123-123a-12a3-123aaaa45678',
    });
  });
});
