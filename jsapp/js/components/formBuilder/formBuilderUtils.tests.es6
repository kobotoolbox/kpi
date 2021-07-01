import {
  cleanupRowName,
} from 'js/components/formBuilder/formBuilderUtils';

describe.only('cleanupRowName', () => {
  // 0 is dirty, 1 is clean
  const testPairs = [
    ['a name here', 'a_name_here'],
    ['A Name Here', 'A_Name_Here'],
    [' a name here', '_a_name_here'],
    ['1st name here', '_st_name_here'],
    ['; name here', '__name_here'],
    [': name here', ':_name_here'],
    ['abc : _ 123 -- . whoa', 'abc_:___123_--_._whoa'],
    ['Zażółć gęślą jaźń', 'Zażółć_gęślą_jaźń'],
  ];

  testPairs.forEach((pair) => {
    it(`should return a clean name for ${pair[0]}`, () => {
      chai.expect(cleanupRowName(pair[0])).to.equal(pair[1]);
    });
  });

  it('should return emtpy string for empty string', () => {
    chai.expect(cleanupRowName('')).to.equal('');
  });

  it('should return emtpy string for non-string', () => {
    chai.expect(cleanupRowName([])).to.equal('');
    chai.expect(cleanupRowName(false)).to.equal('');
    chai.expect(cleanupRowName(true)).to.equal('');
    chai.expect(cleanupRowName(0)).to.equal('');
    chai.expect(cleanupRowName(123)).to.equal('');
    chai.expect(cleanupRowName({})).to.equal('');
  });
});
