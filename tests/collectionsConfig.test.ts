/**
 * Tests for collections configuration
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { loadCollectionsConfig, summarizeCollectionRules, getCollectionByHandle } from '../src/config/collectionsConfig.js';
import type { CollectionsConfig, CollectionConfigEntry } from '../src/types.js';

describe('Collections Configuration', () => {
  let config: CollectionsConfig;

  beforeAll(() => {
    config = loadCollectionsConfig();
  });

  describe('loadCollectionsConfig', () => {
    it('should load the configuration without errors', () => {
      expect(config).toBeDefined();
      expect(config.collections).toBeInstanceOf(Array);
    });

    it('should have a version string', () => {
      expect(config.version).toBeDefined();
      expect(typeof config.version).toBe('string');
    });

    it('should have a vendor set to What You Need', () => {
      expect(config.vendor).toBe('What You Need');
    });

    it('should have at least 20 collections defined', () => {
      expect(config.collections.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Collection entries', () => {
    it('should have unique handles', () => {
      const handles = config.collections.map(c => c.handle);
      const uniqueHandles = new Set(handles);
      expect(handles.length).toBe(uniqueHandles.size);
    });

    it('should have all required fields', () => {
      for (const collection of config.collections) {
        expect(collection.key).toBeDefined();
        expect(collection.title).toBeDefined();
        expect(collection.handle).toBeDefined();
        expect(collection.type).toBeDefined();
      }
    });

    it('should have valid types', () => {
      for (const collection of config.collections) {
        expect(['SMART', 'MANUAL']).toContain(collection.type);
      }
    });

    it('should have valid groups', () => {
      const validGroups = ['devices', 'accessories', 'brands', 'themes', 'merch', 'misc'];
      for (const collection of config.collections) {
        expect(validGroups).toContain(collection.group);
      }
    });
  });

  describe('Smart rules', () => {
    it('should have smart_rules for SMART collections', () => {
      const smartCollections = config.collections.filter(c => c.type === 'SMART');
      for (const collection of smartCollections) {
        expect(collection.smart_rules).toBeDefined();
        expect(collection.smart_rules.conditions).toBeInstanceOf(Array);
        expect(collection.smart_rules.conditions.length).toBeGreaterThan(0);
      }
    });

    it('should have valid condition fields', () => {
      const validFields = ['TAG', 'VENDOR', 'PRODUCT_TYPE'];
      for (const collection of config.collections) {
        if (collection.smart_rules) {
          for (const condition of collection.smart_rules.conditions) {
            expect(validFields).toContain(condition.field);
          }
        }
      }
    });

    it('should have TAG conditions in dimension:value format', () => {
      for (const collection of config.collections) {
        if (collection.smart_rules) {
          for (const condition of collection.smart_rules.conditions) {
            if (condition.field === 'TAG') {
              expect(condition.value).toContain(':');
            }
          }
        }
      }
    });
  });

  describe('Core collections', () => {
    it('should have bongs collection', () => {
      const bongs = getCollectionByHandle(config, 'bongs');
      expect(bongs).toBeDefined();
      expect(bongs?.title).toBe('Bongs');
    });

    it('should have dab-rigs collection', () => {
      const dabRigs = getCollectionByHandle(config, 'dab-rigs');
      expect(dabRigs).toBeDefined();
      expect(dabRigs?.title).toBe('Dab Rigs');
    });

    it('should have shop-all-what-you-need collection', () => {
      const shopAll = getCollectionByHandle(config, 'shop-all-what-you-need');
      expect(shopAll).toBeDefined();
      expect(shopAll?.title).toBe('Shop All What You Need');
    });

    it('should have heady-glass collection', () => {
      const headyGlass = getCollectionByHandle(config, 'heady-glass');
      expect(headyGlass).toBeDefined();
    });
  });

  describe('summarizeCollectionRules', () => {
    it('should return a summary string for collections with rules', () => {
      const bongs = getCollectionByHandle(config, 'bongs');
      if (bongs) {
        const summary = summarizeCollectionRules(bongs);
        expect(summary).toContain('family:glass-bong');
      }
    });

    it('should handle collections without rules', () => {
      const mockCollection: CollectionConfigEntry = {
        key: 'test',
        title: 'Test',
        handle: 'test',
        group: 'misc',
        description: 'Test',
        type: 'MANUAL',
        smart_rules: { appliedDisjunctively: true, conditions: [] },
        vendor_filter: { enabled: false },
        exclude_conditions: []
      };
      const summary = summarizeCollectionRules(mockCollection);
      expect(summary).toBe('No rules');
    });
  });
});
