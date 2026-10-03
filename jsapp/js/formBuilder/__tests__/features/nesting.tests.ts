import { expect } from '@jest/globals'
import type { AssetContent } from '#/dataInterface'
import { XlformAdapter } from '../../adapter'
import structuralNestingForm from '../fixtures/structural-nesting-form.json'

// $xpath is populated on load from a fixture, not computed on serialize for new rows.
// These tests use the structural nesting fixture to verify the $xpath format.

let output: Record<string, any>

beforeAll(() => {
  const adapter = new XlformAdapter()
  adapter.load(structuralNestingForm.content as AssetContent)
  output = JSON.parse(adapter.serialize())
})

describe('nesting', () => {
  it('questions inside a group have $xpath prefixed with the group name', () => {
    const xpaths = output.survey
      .filter((r: any) => r.$xpath?.startsWith('group_oc7df70/'))
      .map((r: any) => r.$xpath)
    expect(xpaths).toEqual([
      'group_oc7df70/Type_a_word',
      'group_oc7df70/Pick_a_food',
    ])
  })

  it('questions inside a repeat have $xpath prefixed with the repeat name', () => {
    const xpaths = output.survey
      .filter((r: any) => r.$xpath?.startsWith('group_zu0ia40/'))
      .map((r: any) => r.$xpath)
    expect(xpaths).toEqual([
      'group_zu0ia40/Pick_a_protein',
      'group_zu0ia40/How_many_servings_of_protein_do_you_want',
    ])
  })
})
