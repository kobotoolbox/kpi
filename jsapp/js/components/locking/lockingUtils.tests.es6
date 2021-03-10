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
  FORM_RESTRICTION_NAMES,
  ROW_RESTRICTION_NAMES,
} from './lockingConstants';
import {getRowName} from 'js/assetUtils';

describe('hasRowRestriction', () => {
  simpleTemplate.content.survey.forEach((row) => {
    ROW_RESTRICTION_NAMES.forEach((restrictionName) => {
      const rowName = getRowName(row);
      it(`should say no restriction for row ${rowName} and restriction ${restrictionName} in un-locked template`, () => {
        const test = hasRowRestriction(simpleTemplate, getRowName(row), restrictionName);
        expect(test).to.equal(false);
      });
    });
  });

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
    ROW_RESTRICTION_NAMES.forEach((restrictionName) => {
      it(`should check row ${rowName} restriction ${restrictionName} in locked template`, () => {
        const test = hasRowRestriction(simpleTemplateLocked, rowName, restrictionName);
        expect(test).to.equal(expectedRestrictions[rowName].includes(restrictionName));
      });
    });
  });
});

describe('hasAssetRestriction', () => {
  FORM_RESTRICTION_NAMES.forEach((restrictionName) => {
    it(`should say no restriction ${restrictionName} for asset in an un-locked template`, () => {
      const test = hasAssetRestriction(simpleTemplate, restrictionName);
      expect(test).to.equal(false);
    });
  });

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
  FORM_RESTRICTION_NAMES.forEach((restrictionName) => {
    it(`should check asset restriction ${restrictionName} in locked template`, () => {
      const test = hasAssetRestriction(simpleTemplateLocked, restrictionName);
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
