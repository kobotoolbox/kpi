import clonedeep from 'lodash.clonedeep';
import {
  simpleTemplate,
  simpleTemplateLocked,
} from './lockingUtils.mocks';
import {
  hasRowRestriction,
  hasAssetRestriction,
  getLockingProfile,
  getRowLockingProfile,
  getAssetLockingProfile,
  isRowLocked,
  isAssetLocked,
  hasAssetAnyLocking,
  isAssetAllLocked,
  isAssetLockable,
  getQuestionFeatures,
  getGroupFeatures,
  getFormFeatures,
} from './lockingUtils';
import {
  LOCKING_RESTRICTIONS,
  LOCK_ALL_PROP_NAME,
  LOCKING_PROFILE_PROP_NAME,
  QUESTION_RESTRICTIONS,
  GROUP_RESTRICTIONS,
  FORM_RESTRICTIONS,
} from './lockingConstants';
import {getRowName} from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';

const simpleTemplateLockedWithAll = clonedeep(simpleTemplateLocked);
simpleTemplateLockedWithAll.content.settings[LOCK_ALL_PROP_NAME] = true;

const simpleTemplateWithAll = clonedeep(simpleTemplate);
simpleTemplateWithAll.content.settings[LOCK_ALL_PROP_NAME] = true;

// a template where only rows have locking profiles
const simpleTemplateLockedRowsOnly = clonedeep(simpleTemplateLocked);
delete simpleTemplateLockedRowsOnly.content.settings[LOCKING_PROFILE_PROP_NAME];

// a template where asset has locking profile but no definition for it
const simpleTemplateLockedFormUndef = clonedeep(simpleTemplateLocked);
simpleTemplateLockedFormUndef.content.settings[LOCKING_PROFILE_PROP_NAME] = 'nonexistent_lock_1';

// a template with no locking profile definitions, but with asset and row having locking profile assigned
const simpleTemplateLockedRowUndef = clonedeep(simpleTemplate);
simpleTemplateLockedRowUndef.content.settings['kobo--locking-profile'] = 'nonexistent_lock_1';
simpleTemplateLockedRowUndef.content.survey[2]['kobo--locking-profile'] = 'nonexistent_lock_2';

describe('hasRowRestriction', () => {
  it('should be false for all restriction for rows in un-locked template', () => {
    simpleTemplate.content.survey.forEach((row) => {
      Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
        const test = hasRowRestriction(
          simpleTemplate.content,
          getRowName(row),
          restrictionName
        );
        expect(test).to.equal(false);
      });
    });
  });

  it('should be true for all restrictions for rows in lock_all template', () => {
    simpleTemplateWithAll.content.survey.forEach((row) => {
      Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
        const test = hasRowRestriction(
          simpleTemplateWithAll.content,
          getRowName(row),
          restrictionName
        );
        expect(test).to.equal(true);
      });
    });
  });

  it('should be true for all restrictions for rows in lock_all template regardless of locking profile', () => {
    simpleTemplateLockedWithAll.content.survey.forEach((row) => {
      Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
        const test = hasRowRestriction(
          simpleTemplateLockedWithAll.content,
          getRowName(row),
          restrictionName
        );
        expect(test).to.equal(true);
      });
    });
  });

  it('should check row restriction in locked template', () => {
    const expectedRestrictions = {
      start: [],
      end: [],
      Best_thing_in_the_world: [
        'question_delete',
        'group_delete',
        'translations_manage',
      ],
      person: [
        'question_delete',
        'group_delete',
        'translations_manage',
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
      Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
        const test = hasRowRestriction(
          simpleTemplateLocked.content,
          rowName,
          restrictionName
        );
        expect(test).to.equal(expectedRestrictions[rowName].includes(restrictionName));
      });
    });
  });
});

describe('hasAssetRestriction', () => {
  it('should say no restrictions for un-locked template', () => {
    Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplate.content, restrictionName);
      expect(test).to.equal(false);
    });
  });

  it('should be true for all restrictions for lock_all template', () => {
    Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplateWithAll.content, restrictionName);
      expect(test).to.equal(true);
    });
  });

  it('should be true for all restrictions for lock_all template regardless of locking profiles', () => {
    Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplateLockedWithAll.content, restrictionName);
      expect(test).to.equal(true);
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
    Object.keys(LOCKING_RESTRICTIONS).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplateLocked.content, restrictionName);
      expect(test).to.equal(expectedRestrictions.includes(restrictionName));
    });
  });
});

describe('getLockingProfile', () => {
  it('should find custom locking profile', () => {
    const test = getLockingProfile(simpleTemplateLocked.content, 'mycustomlock1');
    expect(test).to.deep.equal({
      index: 0,
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

  it('should return proper index for found locking profile', () => {
    const test = getLockingProfile(simpleTemplateLocked.content, 'lock2');
    expect(test).to.deep.equal({
      index: 1,
      name: 'lock2',
      restrictions: [
        'question_delete',
        'group_delete',
        'translations_manage',
      ],
    });
  });

  it('should return null for not found', () => {
    const test = getLockingProfile(simpleTemplateLocked.content, 'nothingness_approaching');
    expect(test).to.equal(null);
  });
});

describe('getRowLockingProfile', () => {
  it('should find custom locking profile for a Row', () => {
    const test = getRowLockingProfile(simpleTemplateLocked.content, 'Your_age');
    expect(test).to.deep.equal({
      index: 0,
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

  it('should return null for not found', () => {
    const test = getRowLockingProfile(simpleTemplateLocked.content, 'Your_name');
    expect(test).to.equal(null);
  });
});

describe('getAssetLockingProfile', () => {
  it('should find custom locking profile for the asset', () => {
    const test = getAssetLockingProfile(simpleTemplateLocked.content);
    expect(test).to.deep.equal({
      index: 0,
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

  it('should return null for locking profile that has no definition', () => {
    const test = getAssetLockingProfile(simpleTemplateLockedFormUndef.content);
    expect(test).to.equal(null);
  });
});

describe('isRowLocked', () => {
  it('should be false for all rows in un-locked template', () => {
    simpleTemplate.content.survey.forEach((row) => {
      const test = isRowLocked(simpleTemplate.content, getRowName(row));
      expect(test).to.equal(false);
    });
  });

  it('should be true for all rows in lock_all template', () => {
    simpleTemplateWithAll.content.survey.forEach((row) => {
      const test = isRowLocked(simpleTemplateWithAll.content, getRowName(row));
      expect(test).to.equal(true);
    });
  });

  it('should be true for all rows in lock_all template regardless of locking profile', () => {
    simpleTemplateLockedWithAll.content.survey.forEach((row) => {
      const test = isRowLocked(simpleTemplateLockedWithAll.content, getRowName(row));
      expect(test).to.equal(true);
    });
  });

  it('should check row being locked in locked template', () => {
    const expectedRestrictions = {
      start: false,
      end: false,
      Best_thing_in_the_world: true,
      person: true,
      Your_name: false,
      Your_age: true,
    };
    Object.keys(expectedRestrictions).forEach((rowName) => {
      const test = isRowLocked(simpleTemplateLocked.content, rowName);
      expect(test).to.equal(expectedRestrictions[rowName]);
    });
  });
});

describe('isAssetLocked', () => {
  it('should be false for un-locked template', () => {
    const test = isAssetLocked(simpleTemplate.content);
    expect(test).to.equal(false);
  });

  it('should be true for template with some locking', () => {
    const test = isAssetLocked(simpleTemplateLocked.content);
    expect(test).to.equal(true);
  });

  it('should be true for template with lock_all', () => {
    const test = isAssetLocked(simpleTemplateWithAll.content);
    expect(test).to.equal(true);
  });

  it('should be false if rows have locking profiles, but asset doesn\'t', () => {
    const test = isAssetLocked(simpleTemplateLockedRowUndef.content);
    expect(test).to.equal(false);
  });

  it('should be false if rows have locking profile, but it\'s definition doesn\'t exist in asset', () => {
    const test = isAssetLocked(simpleTemplateLockedRowUndef.content);
    expect(test).to.equal(false);
  });
});

describe('hasAssetAnyLocking', () => {
  it('should be false for un-locked template', () => {
    const test = hasAssetAnyLocking(simpleTemplate.content);
    expect(test).to.equal(false);
  });

  it('should be true for template with some locking', () => {
    const test = hasAssetAnyLocking(simpleTemplateLocked.content);
    expect(test).to.equal(true);
  });

  it('should be true for template with lock_all', () => {
    const test = hasAssetAnyLocking(simpleTemplateWithAll.content);
    expect(test).to.equal(true);
  });

  it('should be true if rows have locking profiles, but asset doesn\'t', () => {
    const test = hasAssetAnyLocking(simpleTemplateLockedFormUndef.content);
    expect(test).to.equal(true);
  });

  it('should be false if rows have locking profile, but it\'s definition doesn\'t exist in asset', () => {
    const test = hasAssetAnyLocking(simpleTemplateLockedRowUndef.content);
    expect(test).to.equal(false);
  });
});

describe('isAssetAllLocked', () => {
  it('should be false for un-locked template', () => {
    const test = isAssetAllLocked(simpleTemplate.content);
    expect(test).to.equal(false);
  });

  it('should be false for template with some locking', () => {
    const test = isAssetAllLocked(simpleTemplateLocked.content);
    expect(test).to.equal(false);
  });

  it('should be true for template with lock_all', () => {
    const test = isAssetAllLocked(simpleTemplateWithAll.content);
    expect(test).to.equal(true);
  });

  it('should be false for template without content', () => {
    const test = isAssetAllLocked({});
    expect(test).to.equal(false);
  });
});

describe('isAssetLockable', () => {
  it('should be true only for survey', () => {
    expect(isAssetLockable(ASSET_TYPES.question.id)).to.equal(false);
    expect(isAssetLockable(ASSET_TYPES.block.id)).to.equal(false);
    expect(isAssetLockable(ASSET_TYPES.template.id)).to.equal(false);
    expect(isAssetLockable(ASSET_TYPES.survey.id)).to.equal(true);
    expect(isAssetLockable(ASSET_TYPES.collection.id)).to.equal(false);
  });
});

describe('getQuestionFeatures', () => {
  it('should return null if question does not exist', () => {
    const test = getQuestionFeatures(simpleTemplateLocked.content, 'nonexistent_question');
    expect(test).to.equal(null);
  });
  it('should return only cans if question is not locked', () => {
    const test = getQuestionFeatures(simpleTemplate.content, 'Best_thing_in_the_world');
    expect(test.cans.length).to.equal(QUESTION_RESTRICTIONS.length);
    expect(test.cants.length).to.equal(0);
  });
  it('should return some cans and cants if question is locked', () => {
    const test = getQuestionFeatures(simpleTemplateLocked.content, 'Best_thing_in_the_world');
    expect(test.cans.length).to.equal(QUESTION_RESTRICTIONS.length - 1);
    expect(test.cants.length).to.equal(1);
  });
  it('should return only cants if form is fully locked', () => {
    const test = getQuestionFeatures(simpleTemplateLockedWithAll.content, 'Best_thing_in_the_world');
    expect(test.cans.length).to.equal(0);
    expect(test.cants.length).to.equal(QUESTION_RESTRICTIONS.length);
  });
});

describe('getGroupFeatures', () => {
  it('should return null if group does not exist', () => {
    const test = getGroupFeatures(simpleTemplateLocked.content, 'nonexistent_group');
    expect(test).to.equal(null);
  });
  it('should return only cans if group is not locked', () => {
    const test = getGroupFeatures(simpleTemplate.content, 'person');
    expect(test.cans.length).to.equal(GROUP_RESTRICTIONS.length);
    expect(test.cants.length).to.equal(0);
  });
  it('should return some cans and cants if group is locked', () => {
    const test = getGroupFeatures(simpleTemplateLocked.content, 'person');
    expect(test.cans.length).to.equal(GROUP_RESTRICTIONS.length - 1);
    expect(test.cants.length).to.equal(1);
  });
  it('should return only cants if form is fully locked', () => {
    const test = getGroupFeatures(simpleTemplateLockedWithAll.content, 'person');
    expect(test.cans.length).to.equal(0);
    expect(test.cants.length).to.equal(GROUP_RESTRICTIONS.length);
  });
});

describe('getFormFeatures', () => {
  it('should return only cans if form is not locked', () => {
    const test = getFormFeatures(simpleTemplate.content);
    expect(test.cans.length).to.equal(FORM_RESTRICTIONS.length);
    expect(test.cants.length).to.equal(0);
  });
  it('should return some cans and cants if form is locked', () => {
    const test = getFormFeatures(simpleTemplateLocked.content);
    expect(test.cans.length).to.equal(FORM_RESTRICTIONS.length - 2);
    expect(test.cants.length).to.equal(2);
  });
  it('should return only cants if form is fully locked', () => {
    const test = getFormFeatures(simpleTemplateLockedWithAll.content);
    expect(test.cans.length).to.equal(0);
    expect(test.cants.length).to.equal(FORM_RESTRICTIONS.length);
  });
});
