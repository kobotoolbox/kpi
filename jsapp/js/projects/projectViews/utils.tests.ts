import chai from 'chai';
import type {ProjectsFilterDefinition} from './constants';
import {
  removeIncorrectFilters,
  buildQueriesFromFilters,
} from './utils';

describe('projectViewsUtils', () => {
  describe('removeIncorrectFilters', () => {
    it('should return only correct filters', () => {
      const dirty: ProjectsFilterDefinition[] = [
        {fieldName: 'name', condition: 'is', value: 'Foo'},
        {fieldName: 'sector', condition: 'isEmptyObject'},
        // this one is ok, just the value should be dropped
        {fieldName: 'countries', condition: 'isNotEmptyObject', value: 'Bar'},
        // all bad below
        {fieldName: 'languages', condition: 'contains', value: ''},
        {condition: 'isNot', value: 'Fum'},
        {fieldName: 'ownerUsername', value: 'Baz'},
        {fieldName: 'ownerUsername', condition: 'isEmpty'},
        {condition: 'isEmpty'},
        {condition: 'endsWith'},
        {value: 'Asd'},
        {},
      ];
      const clean: ProjectsFilterDefinition[] = [
        {fieldName: 'name', condition: 'is', value: 'Foo'},
        {fieldName: 'sector', condition: 'isEmptyObject'},
        {fieldName: 'countries', condition: 'isNotEmptyObject'},
      ];
      const test = removeIncorrectFilters(dirty);
      chai.expect(test).to.deep.equal(clean);
    });
  });

  describe('buildQueriesFromFilters', () => {
    it('should build as much queries as there are filters', () => {
      const filters: ProjectsFilterDefinition[] = [
        {fieldName: 'name', condition: 'isNot', value: 'Foo'},
        {fieldName: 'name', condition: 'isNot', value: 'Bar'},
        {fieldName: 'name', condition: 'isNot', value: 'Fum'},
        {fieldName: 'description', condition: 'isNotEmpty'},
      ];
      const test = buildQueriesFromFilters(filters);
      chai.expect(test.length).to.equal(filters.length);
    });

    it('should build multiple queries from multiple filters', () => {
      const filters: ProjectsFilterDefinition[] = [
        {fieldName: 'name', condition: 'is', value: 'Foo'},
        {fieldName: 'sector', condition: 'isEmptyObject'},
        {fieldName: 'countries', condition: 'isNotEmptyObject'},
      ];
      const queries = [
        'name__iexact:"Foo"',
        'settings__sector__iexact:{}',
        'NOT settings__country_codes[]__iexact:{}',
      ];
      const test = buildQueriesFromFilters(filters);
      chai.expect(test).to.deep.equal(queries);
    });

    describe('should buid proper query in different cases', () => {
      const cases: Array<{in: ProjectsFilterDefinition; out: string}> = [
        {
          in: {fieldName: 'name', condition: 'doesNotContain', value: 'foo'},
          out: 'NOT name__icontains:"foo"',
        },
        {
          in: {fieldName: 'description', condition: 'startsWith', value: 'foo'},
          out: 'settings__description__istartswith:"foo"',
        },
        {
          in: {fieldName: 'ownerUsername', condition: 'contains', value: 'foo'},
          out:
            '(search_field__owner_username__icontains:"foo" ' +
            'OR search_field__organization_name__icontains:"foo")',
        },
        {
          in: {fieldName: 'ownerUsername', condition: 'is', value: 'foo'},
          out:
            '(search_field__owner_username__iexact:"foo" ' +
            'OR search_field__organization_name__iexact:"foo")',
        },
        {
          in: {fieldName: 'ownerUsername', condition: 'doesNotContain', value: 'foo'},
          out:
            '(NOT search_field__owner_username__icontains:"foo" ' +
            'OR NOT search_field__organization_name__icontains:"foo")',
        },
        {
          in: {fieldName: 'ownerFullName', condition: 'endsWith', value: 'foo'},
          out: 'owner__extra_details__data__name__iendswith:"foo"',
        },
        {
          in: {fieldName: 'ownerEmail', condition: 'is', value: 'foo'},
          out: 'owner__email__iexact:"foo"',
        },
        {
          in: {fieldName: 'ownerOrganization', condition: 'isEmpty'},
          out: 'owner__extra_details__data__organization:""',
        },
        {
          in: {fieldName: 'description', condition: 'isNot', value: 'foo'},
          out: 'NOT settings__description__iexact:"foo"',
        },
        {
          in: {fieldName: 'sector', condition: 'isNotEmptyObject'},
          out: 'NOT settings__sector__iexact:{}',
        },
        {
          in: {fieldName: 'languages', condition: 'is', value: 'foo'},
          out: 'summary__languages[]__iexact:"foo"',
        },
      ];
      cases.forEach((testCase) => {
        it(`should build "${testCase.out}" query from filter`, () => {
          const test = buildQueriesFromFilters([testCase.in]);
          chai.expect(test).to.deep.equal([testCase.out]);
        });
      });
    });
  });
});
