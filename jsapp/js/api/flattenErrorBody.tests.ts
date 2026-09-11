import chai from 'chai'
import { flattenErrorBody } from './flattenErrorBody'

describe('flattenErrorBody', () => {
  it('labels field errors, the shape DRF returns for a failed validation', () => {
    // These used to reach the toast as raw JSON, because `notify()` only unwrapped a lone `detail` key.
    chai.expect(flattenErrorBody({ name: ['This field is required.'] })).to.equal('name: This field is required.')
    // Label per field, not per message.
    chai
      .expect(flattenErrorBody({ new_password: ['This password is too short.', 'This password is too common.'] }))
      .to.equal('new_password: This password is too short. This password is too common.')
    chai
      .expect(flattenErrorBody({ name: ['This field is required.'], email: ['Enter a valid email address.'] }))
      .to.equal('name: This field is required. email: Enter a valid email address.')
  })

  it('handles the other shapes a body arrives in', () => {
    // A bare string instead of the usual list of them.
    chai
      .expect(flattenErrorBody({ permission: 'view_asset cannot be assigned explicitly' }))
      .to.equal('permission: view_asset cannot be assigned explicitly')
    // A nested serializer.
    chai
      .expect(flattenErrorBody({ settings: { sector: ['Invalid choice.'] } }))
      .to.equal('settings: sector: Invalid choice.')
    chai.expect(flattenErrorBody(['Enter a valid value.', 'Try again.'])).to.equal('Enter a valid value. Try again.')
    // Numbers turn up as retry delays and limits.
    chai.expect(flattenErrorBody({ retry_after: 30 })).to.equal('retry_after: 30')
  })

  it('leaves the request-wide keys unlabelled, they read fine on their own', () => {
    chai.expect(flattenErrorBody({ detail: 'Not found.' })).to.equal('Not found.')
    chai
      .expect(flattenErrorBody({ error: 'Another export is in progress.' }))
      .to.equal('Another export is in progress.')
    chai.expect(flattenErrorBody({ non_field_errors: ['Unable to log in.'] })).to.equal('Unable to log in.')
    chai.expect(flattenErrorBody({ __all__: ['Something is off.'] })).to.equal('Something is off.')
  })

  it('prefers a plain-string `error` or `detail` over the rest of the body', () => {
    // Whatever else the body carries is usually context for developers.
    chai
      .expect(flattenErrorBody({ error: 'Could not deploy.', trace: ['File "asset.py"'] }))
      .to.equal('Could not deploy.')
    // Unless the key is itself structured, in which case it gets walked like any other.
    chai.expect(flattenErrorBody({ detail: { name: ['Required.'] } })).to.equal('name: Required.')
  })

  it('takes raw response text too, which is all the legacy fetch wrapper has', () => {
    chai.expect(flattenErrorBody('{"name":["This field is required."]}')).to.equal('name: This field is required.')
    // Text that isn't JSON is already a message.
    chai.expect(flattenErrorBody('Please try again after 5 seconds\n')).to.equal('Please try again after 5 seconds')
  })

  it('returns null when there is no message to show', () => {
    chai.expect(flattenErrorBody(undefined)).to.equal(null)
    chai.expect(flattenErrorBody('')).to.equal(null)
    chai.expect(flattenErrorBody({})).to.equal(null)
    chai.expect(flattenErrorBody({ name: [] })).to.equal(null)
    chai.expect(flattenErrorBody({ name: ['   '] })).to.equal(null)
  })

  it('stops walking a body nested past anything DRF produces', () => {
    // Guards against runaway recursion, nothing more.
    const deep = { lvl1: { lvl2: { lvl3: { lvl4: { lvl5: { lvl6: { lvl7: ['Too far down to show.'] } } } } } } }

    chai.expect(flattenErrorBody(deep)).to.equal(null)
  })
})
