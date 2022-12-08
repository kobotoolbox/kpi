import chai from 'chai';
import type {ProjectsFilterDefinition} from './constants';
import {removeIncorrectFilters} from './utils';

describe('projectViewsUtils', () => {
  describe('removeIncorrectFilters', () => {
    it('should return only correct filters', () => {
      const dirty: ProjectsFilterDefinition[] = [
        {fieldName: 'name', condition: 'is', value: 'Foo'},
        {fieldName: 'sector', condition: 'isEmpty'},
        // this one is ok, just the value should be dropped
        {fieldName: 'countries', condition: 'isNotEmpty', value: 'Bar'},
        // all bad below
        {fieldName: 'languages', condition: 'contains', value: ''},
        {condition: 'isNot', value: 'Fum'},
        {fieldName: 'ownerUsername', value: 'Baz'},
        {condition: 'isEmpty'},
        {condition: 'endsWith'},
        {value: 'Asd'},
        {},
      ];
      const clean: ProjectsFilterDefinition[] = [
        {fieldName: 'name', condition: 'is', value: 'Foo'},
        {fieldName: 'sector', condition: 'isEmpty'},
        {fieldName: 'countries', condition: 'isNotEmpty'},
      ];
      const test = removeIncorrectFilters(dirty);
      chai.expect(test).to.deep.equal(clean);
    });
  });
});
