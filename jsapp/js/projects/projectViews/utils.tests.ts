import chai from 'chai'
import type { ProjectsFilterDefinition } from './constants'
import { buildQueriesFromFilters, removeIncorrectFilters } from './utils'

describe('projectViewsUtils', () => {
  describe('removeIncorrectFilters', () => {
    it('should return only correct filters', () => {
      const dirty: ProjectsFilterDefinition[] = [
        { fieldName: 'name', condition: 'is', value: 'Foo' },
        { fieldName: 'sector', condition: 'isEmptyObject' },
        // this one is ok, just the value should be dropped
        { fieldName: 'countries', condition: 'isNotEmptyObject', value: 'Bar' },
        { fieldName: 'dateDeployed', condition: 'isOnOrAfter', value: '2026-11-11' },
        // all bad below
        // partial date, saved before the date picker
        { fieldName: 'dateModified', condition: 'isOn', value: '2026-11' },
        // text condition, saved before the date picker
        { fieldName: 'dateModified', condition: 'contains', value: '2026-11-11' },
        { fieldName: 'languages', condition: 'contains', value: '' },
        { condition: 'isNot', value: 'Fum' },
        { fieldName: 'ownerUsername', value: 'Baz' },
        { fieldName: 'ownerUsername', condition: 'isEmpty' },
        { condition: 'isEmpty' },
        { condition: 'endsWith' },
        { value: 'Asd' },
        {},
      ]
      const clean: ProjectsFilterDefinition[] = [
        { fieldName: 'name', condition: 'is', value: 'Foo' },
        { fieldName: 'sector', condition: 'isEmptyObject' },
        { fieldName: 'countries', condition: 'isNotEmptyObject' },
        { fieldName: 'dateDeployed', condition: 'isOnOrAfter', value: '2026-11-11' },
      ]
      const test = removeIncorrectFilters(dirty)
      chai.expect(test).to.deep.equal(clean)
    })
  })

  describe('buildQueriesFromFilters', () => {
    it('should build as much queries as there are filters', () => {
      const filters: ProjectsFilterDefinition[] = [
        { fieldName: 'name', condition: 'isNot', value: 'Foo' },
        { fieldName: 'name', condition: 'isNot', value: 'Bar' },
        { fieldName: 'name', condition: 'isNot', value: 'Fum' },
        { fieldName: 'description', condition: 'isNotEmpty' },
      ]
      const test = buildQueriesFromFilters(filters)
      chai.expect(test.length).to.equal(filters.length)
    })

    it('should build multiple queries from multiple filters', () => {
      const filters: ProjectsFilterDefinition[] = [
        { fieldName: 'name', condition: 'is', value: 'Foo' },
        { fieldName: 'sector', condition: 'isEmptyObject' },
        { fieldName: 'countries', condition: 'isNotEmptyObject' },
      ]
      const queries = ['name__iexact:"Foo"', 'settings__sector__iexact:{}', 'NOT settings__country_codes[]__iexact:{}']
      const test = buildQueriesFromFilters(filters)
      chai.expect(test).to.deep.equal(queries)
    })

    describe('should buid proper query in different cases', () => {
      const cases: Array<{ in: ProjectsFilterDefinition; out: string }> = [
        {
          in: { fieldName: 'name', condition: 'doesNotContain', value: 'foo' },
          out: 'NOT name__icontains:"foo"',
        },
        {
          in: { fieldName: 'description', condition: 'startsWith', value: 'foo' },
          out: 'settings__description__istartswith:"foo"',
        },
        {
          in: { fieldName: 'ownerUsername', condition: 'contains', value: 'foo' },
          out:
            '(search_field__owner_username__icontains:"foo" ' + 'OR search_field__organization_name__icontains:"foo")',
        },
        {
          in: { fieldName: 'ownerUsername', condition: 'is', value: 'foo' },
          out: '(search_field__owner_username__iexact:"foo" ' + 'OR search_field__organization_name__iexact:"foo")',
        },
        {
          in: { fieldName: 'ownerUsername', condition: 'doesNotContain', value: 'foo' },
          out:
            '(NOT search_field__owner_username__icontains:"foo" ' +
            'OR NOT search_field__organization_name__icontains:"foo")',
        },
        {
          in: { fieldName: 'ownerFullName', condition: 'endsWith', value: 'foo' },
          out: 'owner__extra_details__data__name__iendswith:"foo"',
        },
        {
          in: { fieldName: 'ownerEmail', condition: 'is', value: 'foo' },
          out: 'owner__email__iexact:"foo"',
        },
        {
          in: { fieldName: 'ownerOrganization', condition: 'isEmpty' },
          out: 'owner__organizations_organization__name:""',
        },
        {
          in: { fieldName: 'description', condition: 'isNot', value: 'foo' },
          out: 'NOT settings__description__iexact:"foo"',
        },
        {
          in: { fieldName: 'sector', condition: 'isNotEmptyObject' },
          out: 'NOT settings__sector__iexact:{}',
        },
        {
          in: { fieldName: 'languages', condition: 'is', value: 'foo' },
          out: 'summary__languages[]__iexact:"foo"',
        },
      ]
      cases.forEach((testCase) => {
        it(`should build "${testCase.out}" query from filter`, () => {
          const test = buildQueriesFromFilters([testCase.in])
          chai.expect(test).to.deep.equal([testCase.out])
        })
      })
    })

    describe('should build date queries in local time', () => {
      // The offset depends on the machine's timezone, so we only check that there is one.
      const midnight = (day: string) => `"${day}T00:00:00\\.000[+-]\\d{2}:\\d{2}"`
      const cases: Array<{ in: ProjectsFilterDefinition; out: RegExp }> = [
        {
          in: { fieldName: 'dateModified', condition: 'isOn', value: '2026-11-11' },
          out: new RegExp(
            `^date_modified__gte:${midnight('2026-11-11')} AND date_modified__lt:${midnight('2026-11-12')}$`,
          ),
        },
        {
          in: { fieldName: 'dateDeployed', condition: 'isOnOrAfter', value: '2026-11-11' },
          out: new RegExp(`^date_deployed__gte:${midnight('2026-11-11')}$`),
        },
        {
          // "On or before" includes the whole picked day.
          in: { fieldName: 'dateDeployed', condition: 'isOnOrBefore', value: '2026-12-31' },
          out: new RegExp(`^date_deployed__lt:${midnight('2027-01-01')}$`),
        },
      ]
      cases.forEach((testCase) => {
        it(`should build ${testCase.in.condition} query`, () => {
          const test = buildQueriesFromFilters([testCase.in])
          chai.expect(test).to.have.length(1)
          chai.expect(test[0]).to.match(testCase.out)
        })
      })
    })
  })
})
