/**
 * Tests for menus configuration
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { loadCollectionsConfig } from '../src/config/collectionsConfig.js';
import { loadMenusConfig, getMenuByHandle, collectTargetHandles, countMenuItems } from '../src/config/menusConfig.js';
import type { CollectionsConfig, MenusConfig } from '../src/types.js';

describe('Menus Configuration', () => {
  let collectionsConfig: CollectionsConfig;
  let menusConfig: MenusConfig;

  beforeAll(() => {
    collectionsConfig = loadCollectionsConfig();
    menusConfig = loadMenusConfig(collectionsConfig);
  });

  describe('loadMenusConfig', () => {
    it('should load the configuration without errors', () => {
      expect(menusConfig).toBeDefined();
      expect(menusConfig.menus).toBeInstanceOf(Array);
    });

    it('should have a version string', () => {
      expect(menusConfig.version).toBeDefined();
      expect(typeof menusConfig.version).toBe('string');
    });

    it('should have at least one menu defined', () => {
      expect(menusConfig.menus.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Main menu', () => {
    it('should have a main-menu', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      expect(mainMenu).toBeDefined();
      expect(mainMenu?.title).toBe('Main menu');
    });

    it('should have items in the main menu', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      expect(mainMenu?.items).toBeInstanceOf(Array);
      expect(mainMenu?.items.length).toBeGreaterThan(0);
    });

    it('should have Shop All as first item', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      const firstItem = mainMenu?.items[0];
      expect(firstItem?.title).toBe('Shop All');
      expect(firstItem?.type).toBe('COLLECTION');
    });

    it('should have Glass menu with children', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      const glassMenu = mainMenu?.items.find(i => i.title === 'Glass');
      expect(glassMenu).toBeDefined();
      expect(glassMenu?.children).toBeInstanceOf(Array);
      expect(glassMenu?.children?.length).toBeGreaterThan(0);
    });

    it('should have Accessories menu with children', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      const accessoriesMenu = mainMenu?.items.find(i => i.title === 'Accessories');
      expect(accessoriesMenu).toBeDefined();
      expect(accessoriesMenu?.children).toBeInstanceOf(Array);
    });

    it('should have Brands menu with children', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      const brandsMenu = mainMenu?.items.find(i => i.title === 'Brands');
      expect(brandsMenu).toBeDefined();
      expect(brandsMenu?.children).toBeInstanceOf(Array);
    });

    it('should have Themes menu with children', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      const themesMenu = mainMenu?.items.find(i => i.title === 'Themes');
      expect(themesMenu).toBeDefined();
      expect(themesMenu?.children).toBeInstanceOf(Array);
    });
  });

  describe('collectTargetHandles', () => {
    it('should collect all collection handles from menu items', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      if (mainMenu) {
        const handles = collectTargetHandles(mainMenu.items);
        expect(handles.length).toBeGreaterThan(0);
        expect(handles).toContain('shop-all-what-you-need');
        expect(handles).toContain('bongs');
      }
    });

    it('should return unique handles', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      if (mainMenu) {
        const handles = collectTargetHandles(mainMenu.items);
        const uniqueHandles = new Set(handles);
        expect(handles.length).toBe(uniqueHandles.size);
      }
    });
  });

  describe('countMenuItems', () => {
    it('should count all items including nested', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      if (mainMenu) {
        const count = countMenuItems(mainMenu.items);
        // Should have at least 30 items (top level + children)
        expect(count).toBeGreaterThanOrEqual(30);
      }
    });
  });

  describe('Menu-Collection references', () => {
    it('should have all menu collection handles exist in collections config', () => {
      const mainMenu = getMenuByHandle(menusConfig, 'main-menu');
      if (mainMenu) {
        const handles = collectTargetHandles(mainMenu.items);
        const collectionHandles = new Set(collectionsConfig.collections.map(c => c.handle));

        for (const handle of handles) {
          expect(collectionHandles.has(handle)).toBe(true);
        }
      }
    });
  });
});
