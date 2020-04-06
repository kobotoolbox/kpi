import {
  simpleSurvey,
  simpleSurveySubmission,
  simpleSurveyDisplayData,
  complexSurvey,
  complexSurveySubmission,
  complexSurveyDisplayData
} from 'js/submissionUtils.mocks';
import {
  getSubmissionDisplayData
} from 'js/submissionUtils';

describe('getSubmissionDisplayData', () => {
  it('should return a valid data for a survey with a group', () => {
      const test = getSubmissionDisplayData(simpleSurvey, 0, simpleSurveySubmission).children;
      const target = simpleSurveyDisplayData;
      expect(test).to.deep.equal(target);
  });

  // it('should return a valid data for a survey with nested repeat groups', () => {
  //     const test = getSubmissionDisplayData(complexSurvey, 0, complexSurveySubmission).children;
  //     const target = complexSurveyDisplayData;
  //     expect(test).to.deep.equal(target);
  // });
});
