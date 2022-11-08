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
  assetWithSupplementalDetails,
  submissionWithSupplementalDetails,
} from './submissionUtils.mocks';
import {
  getValidFilename,
  getMediaAttachment,
  getSubmissionDisplayData,
  getSupplementalDetailsContent,
  getRowSupplementalResponses,
} from './submissionUtils';
import {actions} from 'js/actions';

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
      expect(test).to.deep.equal(target);
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
      expect(test).to.deep.equal(target);
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
      expect(test).to.deep.equal(target);
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
      expect(test).to.deep.equal(target);
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
      expect(test).to.deep.equal(target);
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
      expect(test).to.deep.equal(target);
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
      expect(test).to.deep.equal(target);
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
      expect(test).to.deep.equal(target);
  });
});

describe('getValidFilename', () => {
  it('should return a file name which matches Django renaming', () => {
    const fileName = submissionWithAttachmentsWithUnicode.A_picture;
    const test = getValidFilename(fileName);
    const target = 'Un_ete_au_Quebec_Canada-19_41_32.jpg';
    expect(test).to.equal(target);
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
});

/*
this test should be updated to show that an asset with analysis_form_json.additional_fields
filters columns down to appropriate columns for table view.

describe('getRowSupplementalResponses', () => {
  it('should return display responses for existing and enabled details', () => {
    // Populate assetsStore with data.
    actions.resources.loadAsset.completed(assetWithSupplementalDetails);
    const test = getRowSupplementalResponses(
      assetWithSupplementalDetails,
      submissionWithSupplementalDetails,
      'Secret_password_as_an_audio_file'
    );
    expect(test).to.deep.equal([
      {
        data: 'This is french transcript text.',
        type: null,
        label: 'transcript (fr) | Secret password as an audio file',
        name: '_supplementalDetails/Secret_password_as_an_audio_file/transcript_fr',
      },
      {
        data: 'N/A',
        type: null,
        label: 'transcript (pl) | Secret password as an audio file',
        name: '_supplementalDetails/Secret_password_as_an_audio_file/transcript_pl',
      },
      {
        data: 'This is polish translation text.',
        type: null,
        label: 'translation (pl) | Secret password as an audio file',
        name: '_supplementalDetails/Secret_password_as_an_audio_file/translation_pl',
      },
      {
        data: 'This is german translation text.',
        type: null,
        label: 'translation (de) | Secret password as an audio file',
        name: '_supplementalDetails/Secret_password_as_an_audio_file/translation_de',
      },
    ]);
  });
});
*/
