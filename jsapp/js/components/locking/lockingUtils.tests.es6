import {
  simpleTemplate,
  simpleTemplateLocked,
} from './lockingUtils.mocks';
import {
  hasRowRestriction,
  hasAssetRestriction,
  getLockingProfile,
} from './lockingUtils';
import {
  QUESTION_RESTRICTIONS,
  GROUP_RESTRICTIONS,
  FORM_RESTRICTIONS,
  DEFAULT_LOCKING_PROFILE,
} from './lockingConstants';
import {getRowName} from 'js/assetUtils';

const ROW_RESTRICTIONS = [].concat(
  Object.keys(QUESTION_RESTRICTIONS),
  Object.keys(GROUP_RESTRICTIONS)
);

describe('hasRowRestriction', () => {
  it('should say no restriction for everything in un-locked template', () => {
    simpleTemplate.content.survey.forEach((row) => {
      ROW_RESTRICTIONS.forEach((restriction) => {
        const test = hasRowRestriction(simpleTemplate, getRowName(row), restriction.name);
        expect(test).to.equal(false);
      });
    });
  });

  it('should check rows restrictions in locked template', () => {
    const expectedRestrictions = {
      start: [],
      end: [],
      Best_thing_in_the_world: [
        'question_delete',
        'group_delete',
        'translation_manage',
      ],
      person: [
        'question_delete',
        'group_delete',
        'translation_manage',
      ],
      Your_name: [],
      Your_age: [
        'choice_add',
        'choice_delete',
        'choice_edit',
        'question_settings_edit',
        'group_label_edit',
        'group_question_order_edit',
        'group_add',
        'question_order_edit',
      ],
    };

    Object.keys(expectedRestrictions).forEach((rowName) => {
      ROW_RESTRICTIONS.forEach((restriction) => {
        const test = hasRowRestriction(simpleTemplateLocked, rowName, restriction.name);
        expect(test).to.equal(expectedRestrictions[rowName].includes(restriction.name));
      });
    });
  });
});

describe('hasAssetRestriction', () => {
  it('should say no restriction for asset in un-locked template', () => {
    Object.keys(FORM_RESTRICTIONS).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplate, restrictionName);
      expect(test).to.equal(false);
    });
  });

  it('should check asset restrictions in locked template', () => {
    const expectedRestrictions = [
      'choice_add',
      'choice_delete',
      'choice_edit',
      'question_settings_edit',
      'group_label_edit',
      'group_question_order_edit',
      'group_add',
      'question_order_edit',
    ];
    Object.keys(FORM_RESTRICTIONS).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplate, restrictionName);
      expect(test).to.equal(expectedRestrictions.includes(restrictionName));
    });
  });
});

describe('getLockingProfile', () => {
  it('should find custom locking profile', () => {
    const test = getLockingProfile(simpleTemplateLocked, 'mycustomlock1');
    expect(test).to.deep.equal({
      name: 'mycustomlock1',
      restrictions: [
        'choice_add',
        'choice_delete',
        'choice_edit',
        'question_settings_edit',
        'group_label_edit',
        'group_question_order_edit',
        'group_add',
        'question_order_edit',
      ],
    });
  });

  it('should find default locking profile', () => {
    const test = getLockingProfile(simpleTemplateLocked, 'kobo_default');
    expect(test).to.deep.equal(DEFAULT_LOCKING_PROFILE);
  });

  it('should return null for not found', () => {
    const test = getLockingProfile(simpleTemplateLocked, 'nothingness_approaching');
    expect(test).to.equal(null);
  });
});
