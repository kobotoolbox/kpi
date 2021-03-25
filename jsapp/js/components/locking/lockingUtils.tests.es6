import clonedeep from 'lodash.clonedeep';
import {
  simpleTemplate,
  simpleTemplateLocked,
} from './lockingUtils.mocks';
import {
  hasRowRestriction,
  hasAssetRestriction,
  getLockingProfile,
  isAssetLocked,
  isAssetAllLocked,
} from './lockingUtils';
import {
  LOCKING_RESTRICTIONS,
  LOCK_ALL_PROP_NAME,
} from './lockingConstants';
import {getRowName} from 'js/assetUtils';

const simpleTemplateLockedWithAll = clonedeep(simpleTemplateLocked);
simpleTemplateLockedWithAll.content.settings[LOCK_ALL_PROP_NAME] = true;

const simpleTemplateWithAll = clonedeep(simpleTemplate);
simpleTemplateWithAll.content.settings[LOCK_ALL_PROP_NAME] = true;

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
    const test = getLockingProfile(simpleTemplateLocked.content, 'nothingness_approaching');
    expect(test).to.equal(null);
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
