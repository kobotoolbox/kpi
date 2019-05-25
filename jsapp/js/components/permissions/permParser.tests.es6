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
      // parsed data should only contain data of owner
      chai.expect(parsed.length).to.equal(1);
      chai.expect(parsed[0].user.name).to.equal('kobo');
    });

    it('should group permissions by users properly', () => {
      // in original data there are total 9 permissions (6 of asset owner,
      // 2 of one user and 1 of another)
      chai.expect(endpoints.assetWithMulti.results.length).to.equal(9);
      const parsed = permParser.parseBackendData(
        endpoints.assetWithMulti.results,
        endpoints.assetWithMulti.results[0].user
      );
      // parsed data should contain data of 3 users
      chai.expect(parsed.length).to.equal(3);
      chai.expect(parsed[0].user.name).to.equal('kobo');
      chai.expect(parsed[0].permissions.length).to.equal(6);
      chai.expect(parsed[1].user.name).to.equal('oliver');
      chai.expect(parsed[1].permissions.length).to.equal(1);
      chai.expect(parsed[2].user.name).to.equal('john');
      chai.expect(parsed[2].permissions.length).to.equal(2);
    });
  });
});
