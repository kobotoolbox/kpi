import {
  simpleSurvey,
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
  complexSurvey,
  complexSurveySubmission,
  complexSurveyDisplayData
} from 'js/submissionUtils.mocks';
import {
  getSubmissionDisplayData
} from 'js/submissionUtils';

describe('getSubmissionDisplayData', () => {
  it('should return a valid data for a survey with a group', () => {
      const test = getSubmissionDisplayData(simpleSurvey, null, 0, simpleSurveySubmission).children;
      const target = simpleSurveyDisplayData;
      expect(test).to.deep.equal(target);
  });

  it('should return a null data entries for a survey with no answers', () => {
      const test = getSubmissionDisplayData(simpleSurvey, null, 0, simpleSurveySubmissionEmpty).children;
      const target = simpleSurveyDisplayDataEmpty;
      expect(test).to.deep.equal(target);
  });

  it('should return a valid data for a survey with a repeat group', () => {
      const test = getSubmissionDisplayData(repeatSurvey, null, 0, repeatSurveySubmission).children;
      const target = repeatSurveyDisplayData;
      expect(test).to.deep.equal(target);
  });

  it('should return a valid data for a survey with nested repeat groups', () => {
      const test = getSubmissionDisplayData(nestedRepeatSurvey, null, 0, nestedRepeatSurveySubmission).children;
      const target = nestedRepeatSurveyDisplayData;
      expect(test).to.deep.equal(target);
  });

  it('should return a valid data for a survey with a matrix', () => {
      const test = getSubmissionDisplayData(matrixSurvey, matrixSurveyChoices, 0, matrixSurveySubmission).children;
      const target = matrixSurveyDisplayData;
      expect(test).to.deep.equal(target);
  });

  it('should return a valid data for a very complex survey', () => {
      const test = getSubmissionDisplayData(complexSurvey, null, 0, complexSurveySubmission).children;
      const target = complexSurveyDisplayData;
      expect(test).to.deep.equal(target);
  });
});
