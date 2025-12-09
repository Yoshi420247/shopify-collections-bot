/**
 * Tests for rule mapping logic
 */

import { describe, it, expect } from '@jest/globals';
import { buildCollectionInput, compareRuleSets } from '../src/shopify/collectionsApi.js';
import type { CollectionConfigEntry, ShopifyCollection } from '../src/types.js';

describe('Rule Mapping', () => {
  describe('buildCollectionInput', () => {
    const sampleConfig: CollectionConfigEntry = {
      key: 'test-collection',
      title: 'Test Collection',
      handle: 'test-collection',
      group: 'devices',
      description: 'A test collection',
      type: 'SMART',
      sort_order: 'BEST_SELLING',
      smart_rules: {
        appliedDisjunctively: true,
        conditions: [
          { field: 'TAG', relation: 'EQUALS', value: 'family:glass-bong' },
          { field: 'TAG', relation: 'EQUALS', value: 'family:silicone-bong' }
        ]
      },
      vendor_filter: { enabled: false },
      exclude_conditions: []
    };

    it('should build input with title and handle', () => {
      const input = buildCollectionInput(sampleConfig);
      expect(input.title).toBe('Test Collection');
      expect(input.handle).toBe('test-collection');
    });

    it('should include description', () => {
      const input = buildCollectionInput(sampleConfig);
      expect(input.descriptionHtml).toBe('A test collection');
    });

    it('should map sort order', () => {
      const input = buildCollectionInput(sampleConfig);
      expect(input.sortOrder).toBe('BEST_SELLING');
    });

    it('should build ruleSet for SMART collections', () => {
      const input = buildCollectionInput(sampleConfig);
      expect(input.ruleSet).toBeDefined();
      const ruleSet = input.ruleSet as { appliedDisjunctively: boolean; rules: unknown[] };
      expect(ruleSet.appliedDisjunctively).toBe(true);
      expect(ruleSet.rules).toHaveLength(2);
    });

    it('should map TAG field to TAG column', () => {
      const input = buildCollectionInput(sampleConfig);
      const ruleSet = input.ruleSet as { rules: Array<{ column: string; relation: string; condition: string }> };
      expect(ruleSet.rules[0].column).toBe('TAG');
    });

    it('should include existingId for updates', () => {
      const input = buildCollectionInput(sampleConfig, 'gid://shopify/Collection/123');
      expect(input.id).toBe('gid://shopify/Collection/123');
    });

    it('should not include id for creates', () => {
      const input = buildCollectionInput(sampleConfig);
      expect(input.id).toBeUndefined();
    });
  });

  describe('compareRuleSets', () => {
    it('should return true when both have no rules', () => {
      const existing: ShopifyCollection['ruleSet'] = undefined;
      const config: CollectionConfigEntry = {
        key: 'test',
        title: 'Test',
        handle: 'test',
        group: 'misc',
        description: '',
        type: 'MANUAL',
        smart_rules: { appliedDisjunctively: true, conditions: [] },
        vendor_filter: { enabled: false },
        exclude_conditions: []
      };
      expect(compareRuleSets(existing, config)).toBe(true);
    });

    it('should return false when disjunctive settings differ', () => {
      const existing: ShopifyCollection['ruleSet'] = {
        appliedDisjunctively: true,
        rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'family:glass-bong' }]
      };
      const config: CollectionConfigEntry = {
        key: 'test',
        title: 'Test',
        handle: 'test',
        group: 'devices',
        description: '',
        type: 'SMART',
        smart_rules: {
          appliedDisjunctively: false,
          conditions: [{ field: 'TAG', relation: 'EQUALS', value: 'family:glass-bong' }]
        },
        vendor_filter: { enabled: false },
        exclude_conditions: []
      };
      expect(compareRuleSets(existing, config)).toBe(false);
    });

    it('should return false when rule counts differ', () => {
      const existing: ShopifyCollection['ruleSet'] = {
        appliedDisjunctively: true,
        rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'family:glass-bong' }]
      };
      const config: CollectionConfigEntry = {
        key: 'test',
        title: 'Test',
        handle: 'test',
        group: 'devices',
        description: '',
        type: 'SMART',
        smart_rules: {
          appliedDisjunctively: true,
          conditions: [
            { field: 'TAG', relation: 'EQUALS', value: 'family:glass-bong' },
            { field: 'TAG', relation: 'EQUALS', value: 'family:silicone-bong' }
          ]
        },
        vendor_filter: { enabled: false },
        exclude_conditions: []
      };
      expect(compareRuleSets(existing, config)).toBe(false);
    });

    it('should return true when rules match', () => {
      const existing: ShopifyCollection['ruleSet'] = {
        appliedDisjunctively: true,
        rules: [
          { column: 'TAG', relation: 'EQUALS', condition: 'family:glass-bong' },
          { column: 'TAG', relation: 'EQUALS', condition: 'family:silicone-bong' }
        ]
      };
      const config: CollectionConfigEntry = {
        key: 'test',
        title: 'Test',
        handle: 'test',
        group: 'devices',
        description: '',
        type: 'SMART',
        smart_rules: {
          appliedDisjunctively: true,
          conditions: [
            { field: 'TAG', relation: 'EQUALS', value: 'family:glass-bong' },
            { field: 'TAG', relation: 'EQUALS', value: 'family:silicone-bong' }
          ]
        },
        vendor_filter: { enabled: false },
        exclude_conditions: []
      };
      expect(compareRuleSets(existing, config)).toBe(true);
    });
  });
});
