import permParser from 'permParser';

describe('permParser', () => {
  it('should return properly parsed object', () => {
    const parsed = permParser.parse('xyz');
    chai.expect(parsed).to.equal('xyz');
  });
});
