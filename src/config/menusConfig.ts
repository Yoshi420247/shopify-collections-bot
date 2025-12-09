/**
 * Menus Config Loader
 * Loads and validates the wyn_menus.yml configuration file
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { MenusConfig, MenuConfigEntry, MenuItemConfigEntry, CollectionsConfig } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const CONFIG_PATH = join(PROJECT_ROOT, 'config', 'wyn_menus.yml');

/**
 * Recursively validate menu items and collect all target collection handles
 */
function validateMenuItems(
  items: MenuItemConfigEntry[],
  collectionHandles: Set<string>,
  referencedHandles: Set<string>,
  path: string
): string[] {
  const errors: string[] = [];

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;

    // Validate required fields
    if (!item.title) {
      errors.push(`${itemPath}: missing required field "title"`);
    }
    if (!item.type) {
      errors.push(`${itemPath}: missing required field "type"`);
    }

    // Validate type
    const validTypes = ['COLLECTION', 'PRODUCT', 'PAGE', 'BLOG', 'LINK', 'CATALOG'];
    if (item.type && !validTypes.includes(item.type)) {
      errors.push(`${itemPath}: invalid type "${item.type}", must be one of: ${validTypes.join(', ')}`);
    }

    // For COLLECTION type, validate target_collection_handle
    if (item.type === 'COLLECTION') {
      if (!item.target_collection_handle) {
        errors.push(`${itemPath} (${item.title}): COLLECTION type requires "target_collection_handle"`);
      } else {
        // Track referenced handles for later validation
        referencedHandles.add(item.target_collection_handle);

        // Validate against known collections
        if (!collectionHandles.has(item.target_collection_handle)) {
          errors.push(`${itemPath} (${item.title}): target_collection_handle "${item.target_collection_handle}" not found in collections config`);
        }
      }
    }

    // For LINK type, validate url
    if (item.type === 'LINK' && !item.url) {
      errors.push(`${itemPath} (${item.title}): LINK type requires "url"`);
    }

    // Recursively validate children
    if (item.children && Array.isArray(item.children)) {
      const childErrors = validateMenuItems(
        item.children,
        collectionHandles,
        referencedHandles,
        `${itemPath}.children`
      );
      errors.push(...childErrors);
    }
  });

  return errors;
}

/**
 * Validate a single menu entry
 */
function validateMenuEntry(
  entry: MenuConfigEntry,
  index: number,
  collectionHandles: Set<string>,
  referencedHandles: Set<string>
): string[] {
  const errors: string[] = [];
  const prefix = `Menu #${index + 1} (${entry.handle || 'unknown'})`;

  // Required fields
  if (!entry.handle) {
    errors.push(`${prefix}: missing required field "handle"`);
  }
  if (!entry.title) {
    errors.push(`${prefix}: missing required field "title"`);
  }
  if (!entry.items || !Array.isArray(entry.items)) {
    errors.push(`${prefix}: missing or invalid "items" array`);
  } else {
    // Validate menu items
    const itemErrors = validateMenuItems(
      entry.items,
      collectionHandles,
      referencedHandles,
      `${prefix}.items`
    );
    errors.push(...itemErrors);
  }

  return errors;
}

/**
 * Load and validate the menus configuration
 * Requires CollectionsConfig to validate target_collection_handle references
 */
export function loadMenusConfig(collectionsConfig: CollectionsConfig): MenusConfig {
  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, 'utf-8');
  } catch (error) {
    throw new Error(`Could not read menus config at ${CONFIG_PATH}: ${error}`);
  }

  let config: MenusConfig;
  try {
    config = yaml.load(content) as MenusConfig;
  } catch (error) {
    throw new Error(`Failed to parse menus config YAML: ${error}`);
  }

  // Build set of valid collection handles
  const collectionHandles = new Set<string>();
  collectionsConfig.collections.forEach(c => collectionHandles.add(c.handle));

  // Track all referenced handles for potential warnings
  const referencedHandles = new Set<string>();

  // Validate all menus
  const allErrors: string[] = [];

  if (!config.menus || !Array.isArray(config.menus)) {
    throw new Error('Menus config must have a "menus" array');
  }

  // Check for main-menu
  const hasMainMenu = config.menus.some(m => m.handle === 'main-menu');
  if (!hasMainMenu) {
    allErrors.push('Menus config must include a menu with handle "main-menu"');
  }

  config.menus.forEach((entry, index) => {
    const errors = validateMenuEntry(entry, index, collectionHandles, referencedHandles);
    allErrors.push(...errors);
  });

  if (allErrors.length > 0) {
    throw new Error(`Menus config validation failed:\n${allErrors.map(e => `  - ${e}`).join('\n')}`);
  }

  return config;
}

/**
 * Get a menu by handle
 */
export function getMenuByHandle(config: MenusConfig, handle: string): MenuConfigEntry | undefined {
  return config.menus.find(m => m.handle === handle);
}

/**
 * Recursively collect all target_collection_handle values from menu items
 */
export function collectTargetHandles(items: MenuItemConfigEntry[]): string[] {
  const handles: string[] = [];

  function traverse(items: MenuItemConfigEntry[]) {
    items.forEach(item => {
      if (item.target_collection_handle) {
        handles.push(item.target_collection_handle);
      }
      if (item.children) {
        traverse(item.children);
      }
    });
  }

  traverse(items);
  return [...new Set(handles)];
}

/**
 * Count total menu items (including nested)
 */
export function countMenuItems(items: MenuItemConfigEntry[]): number {
  let count = 0;

  function traverse(items: MenuItemConfigEntry[]) {
    items.forEach(item => {
      count++;
      if (item.children) {
        traverse(item.children);
      }
    });
  }

  traverse(items);
  return count;
}

/**
 * Print menu structure for debugging/preview
 */
export function printMenuStructure(menu: MenuConfigEntry, indent: number = 0): string {
  const lines: string[] = [];
  const indentStr = '  '.repeat(indent);

  if (indent === 0) {
    lines.push(`Menu: ${menu.title} (${menu.handle})`);
  }

  function printItems(items: MenuItemConfigEntry[], depth: number) {
    const prefix = '  '.repeat(depth);
    items.forEach(item => {
      const target = item.target_collection_handle ? ` -> ${item.target_collection_handle}` : '';
      lines.push(`${prefix}- ${item.title} [${item.type}]${target}`);
      if (item.children) {
        printItems(item.children, depth + 1);
      }
    });
  }

  printItems(menu.items, indent + 1);
  return lines.join('\n');
}
