import chai from 'chai';
import customViewStore from './customViewStore';
import { HOME_DEFAULT_VISIBLE_FIELDS } from './projectViews/constants';

describe('customViewStore', () => {
  describe('constructFullQueryParams', () => {
    it('includes asset_type filter by default', () => {
      const store = customViewStore.setUp(
        '',
        '',
        HOME_DEFAULT_VISIBLE_FIELDS,
      )
      const url = new URL('http://www.example.com');
      const params = customViewStore.constructFullQueryParams(url);
      const paramsObject = Object.fromEntries(params)
      chai.expect(paramsObject).to.deep.equal({q: '(asset_type:survey)', limit: '50'});
    });
    it('removes asset_type if includeTypeFilter is false', () => {
      const store = customViewStore.setUp(
        '',
        '',
        HOME_DEFAULT_VISIBLE_FIELDS,
        false,
      )
      const url = new URL('http://www.example.com');
      const params = customViewStore.constructFullQueryParams(url);
      const paramsObject = Object.fromEntries(params)
      chai.expect(paramsObject).to.deep.equal({'limit': '50'});
    });
  });
});
