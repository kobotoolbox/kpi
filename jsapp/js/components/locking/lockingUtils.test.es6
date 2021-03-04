import {
  simpleTemplate,
  simpleTemplateLocked,
} from './lockingUtils.mocks';
import {
  hasRowRestriction,
  hasAssetRestriction,
  getLockingProfile,
} from './lockingUtils';

describe('hasRowRestriction', () => {
  it('should say no restriction for everything in un-locked template', () => {
    // TODO: loop through rows and question+group restrictions
    const test = hasRowRestriction(simpleTemplate);
    expect(test).to.equal(false);
  });

  it('should check rows restrictions in locked template', () => {
    // TODO: loop through rows and question+group restrictions
    const test = hasRowRestriction(simpleTemplate);
    expect(test).to.equal(false);
  });
});

describe('hasAssetRestriction', () => {
  it('should say no restriction for asset in un-locked template', () => {
    // TODO: loop through form restrictions
    const test = hasAssetRestriction(simpleTemplate);
    expect(test).to.equal(false);
  });

  it('should check asset restrictions in locked template', () => {
    // TODO: loop through form restrictions
    const test = hasAssetRestriction(simpleTemplate);
    expect(test).to.equal(false);
  });
});

describe('getLockingProfile', () => {
  it('should find custom locking profile', () => {
    // TODO: should serach for custom profile
    const test = getLockingProfile(simpleTemplate);
    expect(test).to.deep.equal(target);
  });

  it('should find default locking profile', () => {
    // TODO: should serach for default profile
    const test = getLockingProfile(simpleTemplate);
    expect(test).to.deep.equal(target);
  });

  it('should return null for not found', () => {
    // TODO: should search for nonexistent profile ()
    const test = getLockingProfile(simpleTemplate);
    expect(test).to.deep.equal(target);
  });
});
