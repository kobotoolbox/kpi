import { getSubmissionDataListItems } from './submissionDataListUtils'
import {
  assetWithSupplementalDetails,
  repeatSurveyAsset,
  repeatSurveySubmission,
  simpleSurveyAsset,
  simpleSurveySubmission,
  simpleSurveySubmissionEmpty,
  submissionWithSupplementalDetails,
  withAnswerMovedIntoGroup,
  withRenamedRow,
  withRowMovedIntoNewGroup,
} from './submissionUtils.mocks'

describe('getSubmissionDataListItems', () => {
  it('should list the questions of the current form, with the labels of the groups holding them', () => {
    chai.expect(getSubmissionDataListItems(simpleSurveyAsset, 0, simpleSurveySubmission)).to.deep.equal([
      { key: 'First_name', name: 'First_name', label: 'First name', parents: [], data: 'Leszek' },
      {
        key: 'group_favourites/Favourite_color',
        name: 'Favourite_color',
        label: 'Favourite color',
        parents: ['Favourites'],
        data: 'pink',
      },
      {
        key: 'group_favourites/Favourite_number',
        name: 'Favourite_number',
        label: 'Favourite number',
        parents: ['Favourites'],
        data: '24',
      },
    ])
  })

  it('should label questions and groups in the language asked for', () => {
    const items = getSubmissionDataListItems(simpleSurveyAsset, 1, simpleSurveySubmission)

    chai.expect(items.map((item) => item.label)).to.deep.equal(['Pierwsze imię', 'Ulubiony kolor', 'Ulubiona liczba'])
    chai.expect(items[1].parents).to.deep.equal(['Ulubione'])
  })

  it('should keep an unanswered question in the list, with no data', () => {
    const items = getSubmissionDataListItems(simpleSurveyAsset, 0, simpleSurveySubmissionEmpty)

    chai.expect(items.map((item) => item.name)).to.deep.equal(['First_name', 'Favourite_color', 'Favourite_number'])
    chai.expect(items[0].data).to.equal(null)
  })

  // The processing view, the only place this list is shown, has its own tabs for these.
  it('should leave out transcripts, translations and analysis answers', () => {
    const items = getSubmissionDataListItems(assetWithSupplementalDetails, 0, submissionWithSupplementalDetails)

    chai
      .expect(items.map((item) => item.name))
      .to.deep.equal(['Your_name_here', 'Your_selfie_goes_here', 'A_video_WTF', 'Secret_password_as_an_audio_file'])
    chai
      .expect(items.map((item) => item.data))
      .to.deep.equal(['David', null, null, '8BP076-09-rushjet1-unknown_sector-12_42_20.mp3'])
  })

  // What this list is built on `getSubmissionDisplayData` for: walking the form definition can
  // only ask about paths it still has, so such an answer read as unanswered.
  it('should list an answer stored under the path a renamed question used to have', () => {
    const items = getSubmissionDataListItems(
      withRenamedRow(simpleSurveyAsset, 'First_name', 'First_name_v2'),
      0,
      simpleSurveySubmission,
    )

    // The renamed question is in the list too, unanswered: the same "appears twice" the
    // submission preview shows.
    chai.expect(items.find((item) => item.name === 'First_name_v2')?.data).to.equal(null)
    // Nothing is left in the form to name this answer, so the label is its raw path.
    chai
      .expect(items.find((item) => item.name === 'First_name'))
      .to.deep.equal({ key: 'First_name', name: 'First_name', label: 'First_name', parents: [], data: 'Leszek' })
  })

  describe('for a question that moved between groups', () => {
    const rowName = 'Secret_password_as_an_audio_file'
    const groupName = 'audio_group'
    const movedAsset = withRowMovedIntoNewGroup(assetWithSupplementalDetails, rowName, groupName)
    const answer = '8BP076-09-rushjet1-unknown_sector-12_42_20.mp3'

    it('should list the answer of a submission made before the move, under the group the question is in now', () => {
      const items = getSubmissionDataListItems(movedAsset, 0, submissionWithSupplementalDetails)

      // `name` is the last path segment either way, which is what `hideQuestions` matches.
      chai.expect(items.find((item) => item.name === rowName)).to.deep.equal({
        key: rowName,
        name: rowName,
        label: 'Secret password as an audio file',
        parents: [groupName],
        data: answer,
      })
    })

    it('should list the answer of a submission made after the move in the same place', () => {
      const items = getSubmissionDataListItems(
        movedAsset,
        0,
        withAnswerMovedIntoGroup(submissionWithSupplementalDetails, rowName, groupName),
      )

      chai.expect(items.find((item) => item.name === rowName)).to.deep.equal({
        key: `${groupName}/${rowName}`,
        name: rowName,
        label: 'Secret password as an audio file',
        parents: [groupName],
        data: answer,
      })
    })
  })

  // One item per repetition, each with its own key. These used to arrive as one array, which
  // React rendered as its values run together.
  it('should list every repetition of a repeat group separately', () => {
    const items = getSubmissionDataListItems(repeatSurveyAsset, 0, repeatSurveySubmission)

    chai
      .expect(items.map((item) => item.key))
      .to.deep.equal([
        'group_members[1]/First_name',
        'group_members[1]/Middle_name',
        'group_members[1]/Last_name',
        'group_members[2]/First_name',
        'group_members[2]/Middle_name',
        'group_members[2]/Last_name',
      ])
    chai.expect(items.map((item) => item.data)).to.deep.equal(['Leszek', 'Jan', 'Pietrzak', null, null, 'Niepietrzak'])
    // The repeat index is no part of the question's name, or `hideQuestions` would miss it.
    chai
      .expect(items.map((item) => item.name))
      .to.deep.equal(['First_name', 'Middle_name', 'Last_name', 'First_name', 'Middle_name', 'Last_name'])
    chai.expect(items[0].parents).to.deep.equal(['Members'])
  })
})
