import chai from 'chai'
import React from 'react'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import type { SubmissionResponse } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import { getRepeatGroupAnswerTree, getRepeatGroupAnswers } from './repeatGroupUtils'
import { nestedRepeatSurveySubmission } from './submissionUtils.mocks'

function makeSubmission(overrides: Record<string, unknown>): SubmissionResponse {
  return assetDataFactory(1, {
    _attachments: [],
    ...(overrides as Partial<SubmissionResponse>),
  })
}

function makeRepeatItem(path: string, value: string) {
  return {
    [path]: value,
  }
}

function makeRepeatSubmission(
  groupName: string,
  questionName: string,
  values: Array<string | Record<string, string> | null>,
) {
  return makeSubmission({
    [groupName]: values.map((value) => {
      if (typeof value === 'string') {
        return makeRepeatItem(`${groupName}/${questionName}`, value)
      }

      return value
    }),
  })
}

function makeNestedRepeatSubmission(branches: string[][]) {
  return makeSubmission({
    outer_repeat: branches.map((branch) => {
      return {
        'outer_repeat/inner_repeat': branch.map((value) =>
          makeRepeatItem('outer_repeat/inner_repeat/item_name', value),
        ),
      }
    }),
  })
}

function textAnswer(value: string) {
  return { kind: 'text' as const, value }
}

function deletedAttachmentAnswer() {
  return { kind: 'deleted-attachment' as const }
}

describe('getRepeatGroupAnswers', () => {
  it('should return values for a repeat group in root', () => {
    const rootRepeatSubmission = makeRepeatSubmission('children', 'name', ['Ada', 'Grace'])

    const test = getRepeatGroupAnswers(rootRepeatSubmission, 'children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should return values for a repeat group nested inside a regular group', () => {
    const groupedRepeatSubmission = makeSubmission({
      family: {
        'family/children': [
          {
            'family/children/name': 'Ada',
          },
          {
            'family/children/name': 'Grace',
          },
        ],
      },
    })

    const test = getRepeatGroupAnswers(groupedRepeatSubmission, 'family/children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should return no values when repeat group does not exist in submission', () => {
    const submissionWithoutRepeat = makeSubmission({
      other_group: {
        'other_group/name': 'Nope',
      },
    })

    const test = getRepeatGroupAnswers(submissionWithoutRepeat, 'children/name')

    chai.expect(test).to.deep.equal([])
  })

  it('should not match unrelated root-level segment when full repeat path is missing', () => {
    const submissionWithUnrelatedRootName = makeSubmission({
      name: 'Alice',
    })

    const test = getRepeatGroupAnswers(submissionWithUnrelatedRootName, 'group_a/name')

    chai.expect(test).to.deep.equal([])
  })

  it('should skip unanswered iterations and keep answered values', () => {
    const partiallyAnsweredRepeatSubmission = makeRepeatSubmission('children', 'name', [
      'Ada',
      { 'children/age': '11' },
      'Grace',
    ])

    const test = getRepeatGroupAnswers(partiallyAnsweredRepeatSubmission, 'children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should preserve unanswered repeat iterations when includeUnanswered is enabled', () => {
    const partiallyAnsweredRepeatSubmission = makeRepeatSubmission('children', 'name', [
      'Ada',
      { 'children/age': '11' },
      'Grace',
    ])

    const test = getRepeatGroupAnswers(partiallyAnsweredRepeatSubmission, 'children/name', {
      includeUnanswered: true,
      unansweredPlaceholder: '-',
    })

    chai.expect(test).to.deep.equal(['Ada', '-', 'Grace'])
  })

  it('should ignore invalid repeat items and return values from valid objects', () => {
    const mixedRepeatSubmission = makeSubmission({
      children: [
        makeRepeatItem('children/name', 'Ada'),
        null,
        'unexpected-string-item',
        makeRepeatItem('children/name', 'Grace'),
      ],
    })

    const test = getRepeatGroupAnswers(mixedRepeatSubmission, 'children/name')

    chai.expect(test).to.deep.equal(['Ada', 'Grace'])
  })

  it('should return values for a repeat group nested inside another repeat group', () => {
    const test = getRepeatGroupAnswers(nestedRepeatSurveySubmission, 'group_people/group_items/Item_name')

    chai.expect(test).to.deep.equal(['Notebook', 'Pen', 'Shoe', 'Computer'])
  })

  it('should return values for repeat inside regular group when repeat key is flat at root level', () => {
    const rootLevelGroupedRepeatSubmission = makeSubmission({
      'regular_group/nested_repeat': [
        {
          'regular_group/nested_repeat/nested_text': 'c',
        },
        {
          'regular_group/nested_repeat/nested_text': 'd',
        },
      ],
    })

    const test = getRepeatGroupAnswers(rootLevelGroupedRepeatSubmission, 'regular_group/nested_repeat/nested_text')

    chai.expect(test).to.deep.equal(['c', 'd'])
  })

  it('should flatten nested repeat answers into a single list', () => {
    const nestedRepeatForTableDisplay = makeNestedRepeatSubmission([
      ['e', 'f'],
      ['g', 'h'],
    ])

    const test = getRepeatGroupAnswers(nestedRepeatForTableDisplay, 'outer_repeat/inner_repeat/item_name')

    chai.expect(test).to.deep.equal(['e', 'f', 'g', 'h'])
  })

  it('should flatten nested answers and include placeholders for unanswered nested repeat values', () => {
    const nestedRepeatWithMissingValues = makeSubmission({
      outer_repeat: [
        {
          'outer_repeat/inner_repeat': [
            {
              'outer_repeat/inner_repeat/item_name': 'e',
            },
            {
              'outer_repeat/inner_repeat/item_name': 'f',
            },
          ],
        },
        {
          'outer_repeat/inner_repeat': [
            {
              'outer_repeat/inner_repeat/item_name': 'g',
            },
            {
              'outer_repeat/inner_repeat/item_cost': '100',
            },
          ],
        },
      ],
    })

    const test = getRepeatGroupAnswers(nestedRepeatWithMissingValues, 'outer_repeat/inner_repeat/item_name', {
      includeUnanswered: true,
      unansweredPlaceholder: '-',
    })

    chai.expect(test).to.deep.equal(['e', 'f', 'g', '-'])
  })

  it('should return deleted attachment component when repeat answer points to deleted media', () => {
    const submissionWithDeletedRepeatAttachment = makeSubmission({
      _attachments: [
        {
          download_url: 'https://example.test/file.jpg',
          filename: 'file.jpg',
          media_file_basename: 'file.jpg',
          mimetype: 'image/jpeg',
          question_xpath: 'children[1]/photo',
          uid: 'attachment-1',
          is_deleted: true,
        },
      ],
      children: [
        {
          'children/photo': 'file.jpg',
        },
      ],
    })

    const test = getRepeatGroupAnswers(submissionWithDeletedRepeatAttachment, 'children/photo')

    chai.expect(test).to.have.length(1)
    chai.expect(React.isValidElement(test[0])).to.equal(true)
    chai.expect((test[0] as React.ReactElement).type).to.equal(DeletedAttachment)
  })

  it('should return values from repeat groups nested 4 levels deep', () => {
    const fourLevelNestedRepeatSubmission = makeSubmission({
      level1_repeat: [
        {
          'level1_repeat/level2_repeat': [
            {
              'level1_repeat/level2_repeat/level3_repeat': [
                {
                  'level1_repeat/level2_repeat/level3_repeat/level4_repeat': [
                    {
                      'level1_repeat/level2_repeat/level3_repeat/level4_repeat/deep_value': 'alpha',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          'level1_repeat/level2_repeat': [
            {
              'level1_repeat/level2_repeat/level3_repeat': [
                {
                  'level1_repeat/level2_repeat/level3_repeat/level4_repeat': [
                    {
                      'level1_repeat/level2_repeat/level3_repeat/level4_repeat/deep_value': 'beta',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    const test = getRepeatGroupAnswers(
      fourLevelNestedRepeatSubmission,
      'level1_repeat/level2_repeat/level3_repeat/level4_repeat/deep_value',
    )

    chai.expect(test).to.deep.equal(['alpha', 'beta'])
  })
})

describe('getRepeatGroupAnswerTree', () => {
  it('should preserve top-level nested repeat branches without string parentheses', () => {
    const nestedRepeatForTableDisplay = makeNestedRepeatSubmission([
      ['e', 'f'],
      ['g', 'h'],
    ])

    const test = getRepeatGroupAnswerTree(nestedRepeatForTableDisplay, 'outer_repeat/inner_repeat/item_name')

    chai.expect(test).to.deep.equal([
      [textAnswer('e'), textAnswer('f')],
      [textAnswer('g'), textAnswer('h')],
    ])
  })

  it('should keep placeholders inside nested branches when includeUnanswered is enabled', () => {
    const nestedRepeatWithMissingValues = makeSubmission({
      outer_repeat: [
        {
          'outer_repeat/inner_repeat': [
            {
              'outer_repeat/inner_repeat/item_name': 'e',
            },
            {
              'outer_repeat/inner_repeat/item_name': 'f',
            },
          ],
        },
        {
          'outer_repeat/inner_repeat': [
            {
              'outer_repeat/inner_repeat/item_name': 'g',
            },
            {
              'outer_repeat/inner_repeat/item_cost': '100',
            },
          ],
        },
      ],
    })

    const test = getRepeatGroupAnswerTree(nestedRepeatWithMissingValues, 'outer_repeat/inner_repeat/item_name', {
      includeUnanswered: true,
      unansweredPlaceholder: '-',
    })

    chai.expect(test).to.deep.equal([
      [textAnswer('e'), textAnswer('f')],
      [textAnswer('g'), textAnswer('-')],
    ])
  })

  it('should preserve deeper nested repeat hierarchy for modal rendering', () => {
    const multiLevelNestedRepeatSubmission = makeSubmission({
      level1_repeat: [
        {
          'level1_repeat/level2_repeat': [
            {
              'level1_repeat/level2_repeat/level3_repeat': [
                {
                  'level1_repeat/level2_repeat/level3_repeat/value': 'alpha',
                },
                {
                  'level1_repeat/level2_repeat/level3_repeat/value': 'beta',
                },
              ],
            },
            {
              'level1_repeat/level2_repeat/level3_repeat': [
                {
                  'level1_repeat/level2_repeat/level3_repeat/value': 'gamma',
                },
              ],
            },
          ],
        },
      ],
    })

    const test = getRepeatGroupAnswerTree(
      multiLevelNestedRepeatSubmission,
      'level1_repeat/level2_repeat/level3_repeat/value',
    )

    chai.expect(test).to.deep.equal([[[textAnswer('alpha'), textAnswer('beta')], [textAnswer('gamma')]]])
  })

  it('should preserve single-branch depth by default', () => {
    const oneBranchPerLevelSubmission = makeSubmission({
      countries: [
        {
          'countries/cities': [
            {
              'countries/cities/streets': [
                {
                  'countries/cities/streets/houses': [
                    {
                      'countries/cities/streets/houses/inhabitants': [
                        {
                          'countries/cities/streets/houses/inhabitants/name': 'Karl',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    const test = getRepeatGroupAnswerTree(
      oneBranchPerLevelSubmission,
      'countries/cities/streets/houses/inhabitants/name',
    )

    chai.expect(test).to.deep.equal([[[[[textAnswer('Karl')]]]]])
  })

  it('should mark deleted attachment leaves without leaking JSX into the tree', () => {
    const submissionWithDeletedRepeatAttachment = makeSubmission({
      _attachments: [
        {
          download_url: 'https://example.test/file.jpg',
          filename: 'file.jpg',
          media_file_basename: 'file.jpg',
          mimetype: 'image/jpeg',
          question_xpath: 'children[1]/photo',
          uid: 'attachment-1',
          is_deleted: true,
        },
      ],
      children: [
        {
          'children/photo': 'file.jpg',
        },
      ],
    })

    const test = getRepeatGroupAnswerTree(submissionWithDeletedRepeatAttachment, 'children/photo')

    chai.expect(test).to.deep.equal([deletedAttachmentAnswer()])
  })
})
