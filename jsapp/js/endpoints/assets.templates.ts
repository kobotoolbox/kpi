import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content'
import { AssetTypeName, QuestionTypeName } from '#/constants'

/**
 * Template asset definitions for Storybook stories.
 * These are used by assets.mocks.ts when the query includes 'asset_type:template'
 */

export const templateHealthSurvey = getApiV2AssetsRetrieveResponseMock({
  uid: 'template1uid',
  name: 'Community Health Survey Template',
  asset_type: AssetTypeName.template,
  owner__username: 'admin',
  date_created: '2024-01-15T10:30:00Z',
  date_modified: '2024-03-20T14:22:00Z',
  summary: {
    row_count: 15,
    default_translation: 'English',
    languages: ['English'],
  },
  content: {
    survey: [
      { type: QuestionTypeName.text, $kuid: 'q1', name: 'respondent_name', label: ['Respondent Name'] },
      { type: QuestionTypeName.integer, $kuid: 'q2', name: 'age', label: ['Age'] },
      { type: QuestionTypeName.select_one, $kuid: 'q3', name: 'health_status', label: ['General Health Status'] },
    ],
    choices: [],
    settings: {},
  },
})

export const templateEducationAssessment = getApiV2AssetsRetrieveResponseMock({
  uid: 'template2uid',
  name: 'Education Assessment Form',
  asset_type: AssetTypeName.template,
  owner__username: 'researcher',
  date_created: '2024-02-10T09:15:00Z',
  date_modified: '2024-03-18T11:45:00Z',
  summary: {
    row_count: 22,
    default_translation: 'English',
    languages: ['English', 'Spanish'],
  },
  content: {
    survey: [
      { type: QuestionTypeName.text, $kuid: 'q4', name: 'student_name', label: ['Student Name'] },
      { type: QuestionTypeName.select_one, $kuid: 'q5', name: 'grade_level', label: ['Grade Level'] },
      { type: QuestionTypeName.integer, $kuid: 'q6', name: 'test_score', label: ['Test Score'] },
    ],
    choices: [],
    settings: {},
  },
})

export const templateFeedbackSurvey = getApiV2AssetsRetrieveResponseMock({
  uid: 'template3uid',
  name: 'Quick Feedback Survey',
  asset_type: AssetTypeName.template,
  owner__username: 'admin',
  date_created: '2024-01-05T08:00:00Z',
  date_modified: '2024-02-28T16:30:00Z',
  summary: {
    row_count: 8,
    default_translation: 'English',
    languages: ['English'],
  },
  content: {
    survey: [
      { type: QuestionTypeName.select_one, $kuid: 'q7', name: 'satisfaction', label: ['How satisfied are you?'] },
      { type: QuestionTypeName.text, $kuid: 'q8', name: 'comments', label: ['Additional Comments'] },
    ],
    choices: [],
    settings: {},
  },
})

export const mockTemplates = [templateHealthSurvey, templateEducationAssessment, templateFeedbackSurvey]
