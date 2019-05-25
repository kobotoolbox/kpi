import permParser from './permParser';
import permConfig from './permConfig';
import endpoints from './permissionsMocks';

// bootstraping
permConfig.onGetConfigCompleted(endpoints.permissions);

describe('permParser', () => {
  describe('parseBackendData', () => {
    it('should hide anonymous user permissions from output', () => {
      // in original data there are total 7 permissions (6 of asset owner and
      // one of anonymous user)
      chai.expect(endpoints.assetWithAnon.results.length).to.equal(7);
      const parsed = permParser.parseBackendData(
        endpoints.assetWithAnon.results,
        endpoints.assetWithAnon.results[0].user
      );
      // parsed data should only contain owner's data
      chai.expect(parsed.length).to.equal(1);
      chai.expect(parsed[0].user.name).to.equal('kobo');
    });
  });
});
