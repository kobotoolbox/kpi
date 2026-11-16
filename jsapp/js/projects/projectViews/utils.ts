import type { FilterConditionName, ProjectFieldName, ProjectsFilterDefinition } from './constants'
import { FILTER_CONDITIONS, PROJECT_FIELDS } from './constants'

/**
 * Checks if value is required for given filter condition. If no condition is
 * provided, we assume value is needed (useful when filter is being created
 * in ProjectsFilterEditor, and we want the value input to be available before
 * condition is selected).
 */
export function isFilterConditionValueRequired(conditionName?: FilterConditionName) {
  if (conditionName) {
    const conditionDefinition = FILTER_CONDITIONS[conditionName]
    if (conditionDefinition) {
      return conditionDefinition.requiresValue
    }
  }
  return true
}

/** Filter value as a list, so single and multiple values are handled the same way. */
export function getFilterValues(filter: ProjectsFilterDefinition): string[] {
  return ([] as string[]).concat(filter.value ?? []).filter(Boolean)
}

export function isConditionAvailableForFilter(conditionName: FilterConditionName, fieldName: ProjectFieldName) {
  const fieldDefinition = PROJECT_FIELDS[fieldName]
  return fieldDefinition.availableConditions.includes(conditionName)
}

/**
 * Returns a list of only correct filters (e.g. no missing properties allowed).
 */
export function removeIncorrectFilters(filters: ProjectsFilterDefinition[]) {
  const outcome: ProjectsFilterDefinition[] = []
  filters.forEach((filter) => {
    const isValueRequired = isFilterConditionValueRequired(filter.condition)
    if (
      filter.fieldName &&
      filter.condition &&
      isConditionAvailableForFilter(filter.condition, filter.fieldName) &&
      (!isValueRequired || getFilterValues(filter).length > 0)
    ) {
      // We rewrite filter object to avoid including value if a non-value
      // condition was selected.
      const cleanFilter: ProjectsFilterDefinition = {
        fieldName: filter.fieldName,
        condition: filter.condition,
      }
      if (isValueRequired) {
        cleanFilter.value = filter.value
      }
      outcome.push(cleanFilter)
    }
  })
  return outcome
}

export function buildQueriesFromFilters(filters: ProjectsFilterDefinition[]) {
  return removeIncorrectFilters(filters).map((filter) => {
    // It is not possible to not have these two, since `removeIncorrectFilters`
    // was run over `filters`, but TypeScript needs it.
    if (!filter.fieldName || !filter.condition) {
      return ''
    }
    const fieldDefinition = PROJECT_FIELDS[filter.fieldName]
    const conditionDefinition = FILTER_CONDITIONS[filter.condition]

    if (!conditionDefinition.requiresValue) {
      return conditionDefinition.filterQuery.replace('<field>', fieldDefinition.apiFilteringName)
    }

    const buildQuery = (field: string, term: string) =>
      conditionDefinition.filterQuery
        .replace('<field>', field)
        // wrapping term in quotes to make it work with spaces
        .replace('<term>', `"${term}"`)

    const valueQueries = getFilterValues(filter).map((term) => {
      // Filtering by `ownerUsername` should filter on both the owner and organization name
      if (filter.fieldName === 'ownerUsername') {
        return `(${buildQuery('search_field__owner_username', term)} OR ${buildQuery('search_field__organization_name', term)})`
      }
      return buildQuery(fieldDefinition.apiFilteringName, term)
    })

    if (valueQueries.length === 1) {
      return valueQueries[0]
    }
    // "Is" matches any of the values, "Is not" must match none of them.
    const joiner = conditionDefinition.filterQuery.startsWith('NOT ') ? ' AND ' : ' OR '
    return `(${valueQueries.join(joiner)})`
  })
}
