import chai from 'chai'
import { extractInvalidFieldsFromResponseMessage } from './dataAttachmentsUtils'

describe('dataAttachmentsUtils', () => {
  describe('extractInvalidFieldsFromResponseMessage', () => {
    it('returns only requested fields missing from backend choices', () => {
      const requestedFields = [
        'eligibility_form',
        'validation/end/note_validation',
        'validation/end/coordinates_note',
        'comment',
      ]

      const errorPayload = {
        fields: [
          'Some fields are invalid, choices are: `start`, `end`, `eligibility_form`, `validation/end_001/note_validation`, `validation/end_001/coordinates_note`, `comment`',
        ],
      }

      chai
        .expect(extractInvalidFieldsFromResponseMessage(requestedFields, errorPayload))
        .to.deep.equal(['validation/end/note_validation', 'validation/end/coordinates_note'])
    })

    it('returns empty list when payload does not contain field choices', () => {
      chai
        .expect(
          extractInvalidFieldsFromResponseMessage(['field_a'], {
            detail: 'Bad request',
          }),
        )
        .to.deep.equal([])
    })
  })
})
