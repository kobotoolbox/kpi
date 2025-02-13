import {
  simpleTemplate,
  simpleTemplateLocked,
  simpleTemplateLockedWithAll,
  simpleTemplateWithAll,
  simpleTemplateLockedFormUndef,
  simpleTemplateLockedRowUndef,
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
  QUESTION_RESTRICTIONS,
  GROUP_RESTRICTIONS,
  FORM_RESTRICTIONS,
  LockingRestrictionName,
} from './lockingConstants';
import {getRowName} from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {expect} from '@jest/globals';

describe('hasRowRestriction', () => {
  it('should be false for all restriction for rows in un-locked template', () => {
    simpleTemplate.content?.survey?.forEach((row) => {
      Object.values(LockingRestrictionName).forEach((restrictionName) => {
        const test = hasRowRestriction(simpleTemplate.content, getRowName(row), restrictionName);
        expect(test).toEqual(false);
      });
    });
  });

  it('should be true for all restrictions for rows in lock_all template', () => {
    simpleTemplateWithAll.content?.survey?.forEach((row) => {
      Object.values(LockingRestrictionName).forEach((restrictionName) => {
        const test = hasRowRestriction(simpleTemplateWithAll.content, getRowName(row), restrictionName);
        expect(test).toEqual(true);
      });
    });
  });

  it('should be true for all restrictions for rows in lock_all template regardless of locking profile', () => {
    simpleTemplateLockedWithAll.content?.survey?.forEach((row) => {
      Object.values(LockingRestrictionName).forEach((restrictionName) => {
        const test = hasRowRestriction(simpleTemplateLockedWithAll.content, getRowName(row), restrictionName);
        expect(test).toEqual(true);
      });
    });
  });

  it('should check row restriction in locked template', () => {
    const expectedRestrictions: {[rowName: string]: LockingRestrictionName[]} = {
      start: [],
      end: [],
      Best_thing_in_the_world: [
        LockingRestrictionName.question_delete,
        LockingRestrictionName.group_delete,
        LockingRestrictionName.language_edit,
      ],
      person: [
        LockingRestrictionName.question_delete,
        LockingRestrictionName.group_delete,
        LockingRestrictionName.language_edit,
      ],
      Your_name: [],
      Your_age: [
        LockingRestrictionName.choice_add,
        LockingRestrictionName.choice_delete,
        LockingRestrictionName.choice_label_edit,
        LockingRestrictionName.question_settings_edit,
        LockingRestrictionName.group_label_edit,
        LockingRestrictionName.group_question_order_edit,
        LockingRestrictionName.group_add,
        LockingRestrictionName.question_order_edit,
      ],
    };
    Object.keys(expectedRestrictions).forEach((rowName) => {
      Object.values(LockingRestrictionName).forEach((restrictionName) => {
        const test = hasRowRestriction(simpleTemplateLocked.content, rowName, restrictionName);
        expect(test).toEqual(expectedRestrictions[rowName].includes(restrictionName));
      });
    });
  });
});

describe('hasAssetRestriction', () => {
  it('should say no restrictions for un-locked template', () => {
    Object.values(LockingRestrictionName).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplate.content, restrictionName,);
      expect(test).toEqual(false);
    });
  });

  it('should be true for all restrictions for lock_all template', () => {
    Object.values(LockingRestrictionName).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplateWithAll.content, restrictionName,);
      expect(test).toEqual(true);
    });
  });

  it('should be true for all restrictions for lock_all template regardless of locking profiles', () => {
    Object.values(LockingRestrictionName).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplateLockedWithAll.content, restrictionName,);
      expect(test).toEqual(true);
    });
  });

  it('should check asset restrictions in locked template', () => {
    Object.values(LockingRestrictionName).forEach((restrictionName) => {
      const test = hasAssetRestriction(simpleTemplateLocked.content, restrictionName,);
      expect(test).toEqual([
        'choice_add',
        'choice_delete',
        'choice_label_edit',
        'question_settings_edit',
        'group_label_edit',
        'group_question_order_edit',
        'group_add',
        'question_order_edit',
      ].includes(restrictionName));
    });
  });
});

describe('getLockingProfile', () => {
  it('should find custom locking profile', () => {
    const test = getLockingProfile(simpleTemplateLocked.content, 'mycustomlock1');
    expect(test).toEqual({
      index: 0,
      name: 'mycustomlock1',
      restrictions: [
        'choice_add',
        'choice_delete',
        'choice_label_edit',
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
    expect(test).toEqual({
      index: 1,
      name: 'lock2',
      restrictions: [
        'question_delete',
        'group_delete',
        'language_edit',
      ],
    });
  });

  it('should return null for not found', () => {
    const test = getLockingProfile(simpleTemplateLocked.content, 'nothingness_approaching');
    expect(test).toEqual(null);
  });
});

describe('getRowLockingProfile', () => {
  it('should find custom locking profile for a Row', () => {
    const test = getRowLockingProfile(simpleTemplateLocked.content, 'Your_age');
    expect(test).toEqual({
      index: 0,
      name: 'mycustomlock1',
      restrictions: [
        'choice_add',
        'choice_delete',
        'choice_label_edit',
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
    expect(test).toEqual(null);
  });
});

describe('getAssetLockingProfile', () => {
  it('should find custom locking profile for the asset', () => {
    const test = getAssetLockingProfile(simpleTemplateLocked.content);
    expect(test).toEqual({
      index: 0,
      name: 'mycustomlock1',
      restrictions: [
        'choice_add',
        'choice_delete',
        'choice_label_edit',
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
    expect(test).toEqual(null);
  });
});

describe('isRowLocked', () => {
  it('should be false for all rows in un-locked template', () => {
    simpleTemplate.content?.survey?.forEach((row) => {
      const test = isRowLocked(simpleTemplate.content, getRowName(row));
      expect(test).toEqual(false);
    });
  });

  it('should be true for all rows in lock_all template', () => {
    simpleTemplateWithAll.content?.survey?.forEach((row) => {
      const test = isRowLocked(simpleTemplateWithAll.content, getRowName(row));
      expect(test).toEqual(true);
    });
  });

  it('should be true for all rows in lock_all template regardless of locking profile', () => {
    simpleTemplateLockedWithAll.content?.survey?.forEach((row) => {
      const test = isRowLocked(simpleTemplateLockedWithAll.content, getRowName(row));
      expect(test).toEqual(true);
    });
  });

  it('should check row being locked in locked template', () => {
    const expectedRestrictions: {[key: string]: boolean} = {
      start: false,
      end: false,
      Best_thing_in_the_world: true,
      person: true,
      Your_name: false,
      Your_age: true,
    };
    Object.keys(expectedRestrictions).forEach((rowName) => {
      const test = isRowLocked(simpleTemplateLocked.content, rowName);
      expect(test).toEqual(expectedRestrictions[rowName]);
    });
  });
});

describe('isAssetLocked', () => {
  it('should be false for un-locked template', () => {
    const test = isAssetLocked(simpleTemplate.content);
    expect(test).toEqual(false);
  });

  it('should be true for template with some locking', () => {
    const test = isAssetLocked(simpleTemplateLocked.content);
    expect(test).toEqual(true);
  });

  it('should be true for template with lock_all', () => {
    const test = isAssetLocked(simpleTemplateWithAll.content);
    expect(test).toEqual(true);
  });

  it('should be false if rows have locking profiles, but asset doesn\'t', () => {
    const test = isAssetLocked(simpleTemplateLockedRowUndef.content);
    expect(test).toEqual(false);
  });

  it('should be false if rows have locking profile, but it\'s definition doesn\'t exist in asset', () => {
    const test = isAssetLocked(simpleTemplateLockedRowUndef.content);
    expect(test).toEqual(false);
  });
});

describe('hasAssetAnyLocking', () => {
  it('should be false for un-locked template', () => {
    const test = hasAssetAnyLocking(simpleTemplate.content);
    expect(test).toEqual(false);
  });

  it('should be true for template with some locking', () => {
    const test = hasAssetAnyLocking(simpleTemplateLocked.content);
    expect(test).toEqual(true);
  });

  it('should be true for template with lock_all', () => {
    const test = hasAssetAnyLocking(simpleTemplateWithAll.content);
    expect(test).toEqual(true);
  });

  it('should be true if rows have locking profiles, but asset doesn\'t', () => {
    const test = hasAssetAnyLocking(simpleTemplateLockedFormUndef.content);
    expect(test).toEqual(true);
  });

  it('should be false if rows have locking profile, but it\'s definition doesn\'t exist in asset', () => {
    const test = hasAssetAnyLocking(simpleTemplateLockedRowUndef.content);
    expect(test).toEqual(false);
  });
});

describe('isAssetAllLocked', () => {
  it('should be false for un-locked template', () => {
    const test = isAssetAllLocked(simpleTemplate.content);
    expect(test).toEqual(false);
  });

  it('should be false for template with some locking', () => {
    const test = isAssetAllLocked(simpleTemplateLocked.content);
    expect(test).toEqual(false);
  });

  it('should be true for template with lock_all', () => {
    const test = isAssetAllLocked(simpleTemplateWithAll.content);
    expect(test).toEqual(true);
  });

  it('should be false for template without content', () => {
    const test = isAssetAllLocked({});
    expect(test).toEqual(false);
  });
});

describe('isAssetLockable', () => {
  it('should be true only for survey', () => {
    expect(isAssetLockable(ASSET_TYPES.question.id)).toEqual(false);
    expect(isAssetLockable(ASSET_TYPES.block.id)).toEqual(false);
    expect(isAssetLockable(ASSET_TYPES.template.id)).toEqual(true);
    expect(isAssetLockable(ASSET_TYPES.survey.id)).toEqual(true);
    expect(isAssetLockable(ASSET_TYPES.collection.id)).toEqual(false);
  });
});

describe('getQuestionFeatures', () => {
  it('should return null if question does not exist', () => {
    const test = getQuestionFeatures(simpleTemplateLocked.content, 'nonexistent_question');
    expect(test).toEqual(null);
  });
  it('should return only cans if question is not locked', () => {
    const test = getQuestionFeatures(simpleTemplate.content, 'Best_thing_in_the_world') || null;
    expect(test?.cans?.length).toEqual(QUESTION_RESTRICTIONS.length);
    expect(test?.cants?.length).toEqual(0);
  });
  it('should return some cans and cants if question is locked', () => {
    const test = getQuestionFeatures(simpleTemplateLocked.content, 'Best_thing_in_the_world') || null;
    expect(test?.cans.length).toEqual(QUESTION_RESTRICTIONS.length - 1);
    expect(test?.cants.length).toEqual(1);
  });
  it('should return only cants if form is fully locked', () => {
    const test = getQuestionFeatures(simpleTemplateLockedWithAll.content, 'Best_thing_in_the_world') || null;
    expect(test?.cans.length).toEqual(0);
    expect(test?.cants.length).toEqual(QUESTION_RESTRICTIONS.length);
  });
});

describe('getGroupFeatures', () => {
  it('should return null if group does not exist', () => {
    const test = getGroupFeatures(simpleTemplateLocked.content, 'nonexistent_group') || null;
    expect(test).toEqual(null);
  });
  it('should return only cans if group is not locked', () => {
    const test = getGroupFeatures(simpleTemplate.content, 'person') || null;
    expect(test?.cans.length).toEqual(GROUP_RESTRICTIONS.length);
    expect(test?.cants.length).toEqual(0);
  });
  it('should return some cans and cants if group is locked', () => {
    const test = getGroupFeatures(simpleTemplateLocked.content, 'person') || null;
    expect(test?.cans.length).toEqual(GROUP_RESTRICTIONS.length - 1);
    expect(test?.cants.length).toEqual(1);
  });
  it('should return only cants if form is fully locked', () => {
    const test = getGroupFeatures(simpleTemplateLockedWithAll.content, 'person') || null;
    expect(test?.cans.length).toEqual(0);
    expect(test?.cants.length).toEqual(GROUP_RESTRICTIONS.length);
  });
});

describe('getFormFeatures', () => {
  it('should return only cans if form is not locked', () => {
    const test = getFormFeatures(simpleTemplate.content) || null;
    expect(test?.cans.length).toEqual(FORM_RESTRICTIONS.length);
    expect(test?.cants.length).toEqual(0);
  });
  it('should return some cans and cants if form is locked', () => {
    const test = getFormFeatures(simpleTemplateLocked.content) || null;
    expect(test?.cans.length).toEqual(FORM_RESTRICTIONS.length - 2);
    expect(test?.cants.length).toEqual(2);
  });
  it('should return only cants if form is fully locked', () => {
    const test = getFormFeatures(simpleTemplateLockedWithAll.content) || null;
    expect(test?.cans.length).toEqual(0);
    expect(test?.cants.length).toEqual(FORM_RESTRICTIONS.length);
  });
});
