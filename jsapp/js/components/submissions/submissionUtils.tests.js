import {
  simpleSurvey,
  simpleSurveyChoices,
  simpleSurveySubmission,
  simpleSurveyDisplayData,
  simpleSurveySubmissionEmpty,
  simpleSurveyDisplayDataEmpty,
  repeatSurvey,
  repeatSurveySubmission,
  repeatSurveyDisplayData,
  nestedRepeatSurvey,
  nestedRepeatSurveySubmission,
  nestedRepeatSurveyDisplayData,
  matrixSurvey,
  matrixSurveyChoices,
  matrixSurveySubmission,
  matrixSurveyDisplayData,
  groupsSurvey,
  groupsSurveyChoices,
  groupsSurveySubmission,
  groupsSurveyDisplayData,
  everythingSurvey,
  everythingSurveyChoices,
  everythingSurveySubmission,
  everythingSurveyDisplayData,
  matrixRepeatSurvey,
  matrixRepeatSurveyChoices,
  matrixRepeatSurveySubmission,
  matrixRepeatSurveyDisplayData,
  submissionWithAttachmentsWithUnicode,
  submissionWithSupplementalDetails,
} from './submissionUtils.mocks';
import {
  getMediaAttachment,
  getSubmissionDisplayData,
  getSupplementalDetailsContent,
} from './submissionUtils';

// getSubmissionDisplayData() returns objects that have prototype chains, while
// the simple mock objects do not. Be able to exclude __proto__ when comparing
// the two
import chaiExclude from 'chai-exclude';
chai.use(chaiExclude);

// getSubmissionDisplayData might return objects with declared, undefined key:
//    {... "label": "hi", "listName": undefined, "name": "hi" ...}
// Assuming this is correct, test fixtures like this are equivalent enough:
//    {... "label": "hi", "name": "hi" ...}
// After a recent chai / deep-eql update, tests relying on this behavior would
// fail. Hence, use this looser comparison function.
import chaiDeepEqualIgnoreUndefined from 'chai-deep-equal-ignore-undefined'
chai.use(chaiDeepEqualIgnoreUndefined);

describe('getSubmissionDisplayData', () => {
  it('should return a valid data for a survey with a group', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: simpleSurvey,
            choices: simpleSurveyChoices,
          },
        }, 1, simpleSurveySubmission).children;
      const target = simpleSurveyDisplayData;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });

  it('should return a null data entries for a survey with no answers', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: simpleSurvey,
            choices: simpleSurveyChoices,
          },
        }, 0, simpleSurveySubmissionEmpty).children;
      const target = simpleSurveyDisplayDataEmpty;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });

  it('should return a valid data for a survey with a repeat group', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: repeatSurvey,
            choices: null,
          },
        }, 0, repeatSurveySubmission).children;
      const target = repeatSurveyDisplayData;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });

  it('should return a valid data for a survey with nested repeat groups', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: nestedRepeatSurvey,
            choices: null,
          },
        }, 0, nestedRepeatSurveySubmission).children;
      const target = nestedRepeatSurveyDisplayData;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });

  it('should return a valid data for a survey with a matrix', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: matrixSurvey,
            choices: matrixSurveyChoices,
          },
        }, 0, matrixSurveySubmission).children;
      const target = matrixSurveyDisplayData;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });

  it('should return a valid data for a survey with all kinds of groups', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: groupsSurvey,
            choices: groupsSurveyChoices,
          },
        }, 0, groupsSurveySubmission).children;
      const target = groupsSurveyDisplayData;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });

  it('should return a valid data for every possible question type', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: everythingSurvey,
            choices: everythingSurveyChoices,
          },
        }, 0, everythingSurveySubmission).children;
      const target = everythingSurveyDisplayData;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });

  it('should return a valid data for a matrix group inside repeat group', () => {
      const test = getSubmissionDisplayData(
        {
          uid: 'abc',
          content: {
            survey: matrixRepeatSurvey,
            choices: matrixRepeatSurveyChoices,
          },
        }, 0, matrixRepeatSurveySubmission).children;
      const target = matrixRepeatSurveyDisplayData;
      expect(test)
        .excludingEvery(['__proto__', 'xpathNodes'])
        .to.deepEqualIgnoreUndefined(target);
  });
});

describe('getMediaAttachment', () => {
  it('should return an attachment object', () => {
    const fileName = submissionWithAttachmentsWithUnicode.A_picture;
    const test = getMediaAttachment(submissionWithAttachmentsWithUnicode, fileName);
    const target = submissionWithAttachmentsWithUnicode._attachments[0];
    expect(test).to.deep.equal(target);
  });
});

describe('getSupplementalDetailsContent', () => {
  it('should return transcript value properly', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/transcript_fr'
    );
    expect(test).to.equal('This is french transcript text.');
  });

  it('should return translation value properly', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/translation_pl'
    );
    expect(test).to.equal('This is polish translation text.');
  });

  it('should return analysis question value properly for qual_select_multiple', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/1a89e0da-3344-4b5d-b919-ab8b072e0918'
    );
    expect(test).to.equal('First, Third');
  });

  it('should return analysis question value properly for qual_tags', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/b05f29f7-8b58-4dd7-8695-c29cb04f3f7a'
    );
    expect(test).to.equal('best, things, ever recorder by human, 3');
  });

  it('should return analysis question value properly for qual_integer', () => {
    const test = getSupplementalDetailsContent(
      submissionWithSupplementalDetails,
      '_supplementalDetails/Secret_password_as_an_audio_file/97fd5387-ac2b-4108-b5b4-37fa91ae0e22'
    );
    expect(test).to.equal('12345');
  });
});
