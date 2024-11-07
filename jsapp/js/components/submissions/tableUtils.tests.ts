import {getColumnLabel} from './tableUtils';
import {
  assetWithBgAudioAndNLP,
  assetWithNestedGroupsAndNLP,
} from './tableUtils.mocks';

describe('tableUtils', () => {
  describe('getColumnLabel', () => {
    it('should return proper label for background-audio question', () => {
      const test = getColumnLabel(
        assetWithBgAudioAndNLP,
        'background-audio',
        true
      );
      chai.expect(test).to.equal('Background audio');
    });

    it('should return proper label for qualitative analysis question (id e59a3552-c06c-43f2-92f1-8e3607052624) for background-audio question', () => {
      const test = getColumnLabel(
        assetWithBgAudioAndNLP,
        '_supplementalDetails/background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        true
      );
      chai.expect(test).to.equal('Is this bg audio? | Background audio');
    });

    it('should return proper label for transcript of background-audio question', () => {
      const test = getColumnLabel(
        assetWithBgAudioAndNLP,
        '_supplementalDetails/background-audio/transcript_en',
        true
      );
      chai.expect(test).to.equal('transcript (en) | Background audio');
    });

    it('should return proper label for translation of background-audio question', () => {
      const test = getColumnLabel(
        assetWithBgAudioAndNLP,
        '_supplementalDetails/background-audio/translation_fr',
        true
      );
      chai.expect(test).to.equal('translation (fr) | Background audio');
    });

    it('should return provided key (row name) as a fallback', () => {
      const test = getColumnLabel(
        assetWithBgAudioAndNLP,
        'i_have_no_mouth_and_i_must_scream',
        true
      );
      chai.expect(test).to.equal('i_have_no_mouth_and_i_must_scream');
    });

    it('should return proper label for nested group audio question', () => {
      const test = getColumnLabel(
        assetWithNestedGroupsAndNLP,
        'outer_group/middle_group/inner_group/What_did_you_hear',
        true
      );
      chai.expect(test).to.equal('Outer group / Middle group / Inner group / What did you hear?');
    });

    it('should return proper label for transcript of a nested group audio question', () => {
      const test = getColumnLabel(
        assetWithNestedGroupsAndNLP,
        '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        true
      );
      chai.expect(test).to.equal('transcript (pl) | Outer group / Middle group / Inner group / What did you hear?');
    });

    it('should return proper no-groups label for transcript of a nested group audio question', () => {
      const test = getColumnLabel(
        assetWithNestedGroupsAndNLP,
        '_supplementalDetails/outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        false
      );
      chai.expect(test).to.equal('transcript (pl) | What did you hear?');
    });

    // TODO: write more tests here… I haven't got enough time to go over all
    // possible cases, just added one that I was fixing a bug for and a couple
    // that came to my mind.
  });
});
