import type {
  FilterConditionName,
  ProjectsFilterDefinition,
} from './constants';
import {FILTER_CONDITIONS} from './constants';

/**
 * Checks if value is requied for given filter condition. If no condition is
 * provided, we assume value is needed (useful when filter is being created
 * in ProjectsFilterEditor, and we want the value input to be available before
 * condition is selected).
 */
export function isFilterConditionValueRequired(conditionName?: FilterConditionName) {
  if (conditionName) {
    const conditionDefinition = FILTER_CONDITIONS[conditionName];
    if (conditionDefinition) {
      return conditionDefinition.requiresValue;
    }
  }
  return true;
}

/** Returns a list of only correct filters (e.g. no missing properties allowed). */
export function removeIncorrectFilters(filters: ProjectsFilterDefinition[]) {
  const outcome: ProjectsFilterDefinition[] = [];
    filters.forEach((filter) => {
      const isValueRequired = isFilterConditionValueRequired(filter.condition);
      if (
        filter.fieldName &&
        filter.condition &&
        (
          !isValueRequired ||
          (isValueRequired && filter.value)
        )
      ) {
        // We rewrite filter object to avoid including value if a non-value
        // condition was selected.
        const cleanFilter: ProjectsFilterDefinition = {
          fieldName: filter.fieldName,
          condition: filter.condition,
        };
        if (isValueRequired) {
          cleanFilter.value = filter.value;
        }
        outcome.push(cleanFilter);
      }
    });
    return outcome;
}
