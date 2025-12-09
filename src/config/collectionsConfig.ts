/**
 * Collections Config Loader
 * Loads and validates the wyn_collections.yml configuration file
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { CollectionsConfig, CollectionConfigEntry, SmartRuleCondition, ParsedTaggingSpec } from '../types.js';
import { loadParsedTaggingSpec } from './taggingSpecLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Valid config names
export type ConfigName = 'wyn' | 'oilslick';

/**
 * Get the config file path for a given config name
 */
function getConfigPath(configName: ConfigName): string {
  return join(PROJECT_ROOT, 'config', `${configName}_collections.yml`);
}

/**
 * Validate a single collection entry
 */
function validateCollectionEntry(
  entry: CollectionConfigEntry,
  index: number,
  allHandles: Set<string>,
  spec: ParsedTaggingSpec
): string[] {
  const errors: string[] = [];
  const prefix = `Collection #${index + 1} (${entry.key || 'unknown'})`;

  // Required fields
  if (!entry.key) {
    errors.push(`${prefix}: missing required field "key"`);
  }
  if (!entry.title) {
    errors.push(`${prefix}: missing required field "title"`);
  }
  if (!entry.handle) {
    errors.push(`${prefix}: missing required field "handle"`);
  }
  if (!entry.type) {
    errors.push(`${prefix}: missing required field "type"`);
  }

  // Check for duplicate handles
  if (entry.handle) {
    if (allHandles.has(entry.handle)) {
      errors.push(`${prefix}: duplicate handle "${entry.handle}"`);
    }
    allHandles.add(entry.handle);
  }

  // Validate type
  if (entry.type && !['SMART', 'MANUAL'].includes(entry.type)) {
    errors.push(`${prefix}: invalid type "${entry.type}", must be "SMART" or "MANUAL"`);
  }

  // Validate group
  const validGroups = ['devices', 'accessories', 'brands', 'themes', 'merch', 'misc', 'parent', 'extraction', 'packaging'];
  if (entry.group && !validGroups.includes(entry.group)) {
    errors.push(`${prefix}: invalid group "${entry.group}", must be one of: ${validGroups.join(', ')}`);
  }

  // Validate sort_order
  const validSortOrders = ['ALPHA_ASC', 'ALPHA_DESC', 'BEST_SELLING', 'CREATED', 'CREATED_DESC', 'MANUAL', 'PRICE_ASC', 'PRICE_DESC'];
  if (entry.sort_order && !validSortOrders.includes(entry.sort_order)) {
    errors.push(`${prefix}: invalid sort_order "${entry.sort_order}"`);
  }

  // Validate smart_rules for SMART collections
  if (entry.type === 'SMART') {
    if (!entry.smart_rules) {
      errors.push(`${prefix}: SMART collection requires "smart_rules"`);
    } else {
      if (typeof entry.smart_rules.appliedDisjunctively !== 'boolean') {
        errors.push(`${prefix}: smart_rules.appliedDisjunctively must be a boolean`);
      }
      if (!Array.isArray(entry.smart_rules.conditions) || entry.smart_rules.conditions.length === 0) {
        errors.push(`${prefix}: smart_rules must have at least one condition`);
      } else {
        // Validate each condition
        entry.smart_rules.conditions.forEach((condition, condIndex) => {
          const condErrors = validateCondition(condition, spec, `${prefix} condition #${condIndex + 1}`);
          errors.push(...condErrors);
        });
      }
    }

    // Validate exclude_conditions if present
    if (entry.exclude_conditions && Array.isArray(entry.exclude_conditions)) {
      entry.exclude_conditions.forEach((condition, condIndex) => {
        const condErrors = validateCondition(condition, spec, `${prefix} exclude_condition #${condIndex + 1}`);
        errors.push(...condErrors);
      });
    }
  }

  return errors;
}

/**
 * Validate a smart rule condition
 */
function validateCondition(
  condition: SmartRuleCondition,
  spec: ParsedTaggingSpec,
  prefix: string
): string[] {
  const errors: string[] = [];

  // Valid field types
  const validFields = ['TAG', 'VENDOR', 'PRODUCT_TYPE', 'VARIANT_PRICE', 'VARIANT_COMPARE_AT_PRICE', 'VARIANT_WEIGHT', 'VARIANT_INVENTORY', 'VARIANT_TITLE'];
  if (!validFields.includes(condition.field)) {
    errors.push(`${prefix}: invalid field "${condition.field}"`);
  }

  // Valid relation types
  const validRelations = ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'STARTS_WITH', 'ENDS_WITH', 'CONTAINS', 'NOT_CONTAINS'];
  if (!validRelations.includes(condition.relation)) {
    errors.push(`${prefix}: invalid relation "${condition.relation}"`);
  }

  // Validate TAG conditions
  if (condition.field === 'TAG' && condition.value) {
    // Check that the tag follows dimension:value format
    if (!condition.value.includes(':')) {
      errors.push(`${prefix}: TAG value "${condition.value}" should be in dimension:value format`);
    } else {
      const [dimension] = condition.value.split(':');
      if (!spec.allowedDimensions.includes(dimension)) {
        errors.push(`${prefix}: unknown dimension "${dimension}" in TAG value "${condition.value}"`);
      }
    }
  }

  return errors;
}

/**
 * Load and validate the collections configuration
 * @param configName - The config name to load ('wyn' or 'oilslick'). Defaults to env CONFIG_NAME or 'wyn'.
 */
export function loadCollectionsConfig(configName?: ConfigName): CollectionsConfig {
  // Resolve config name: parameter > env > default
  const resolvedConfigName: ConfigName = configName ||
    (process.env.CONFIG_NAME as ConfigName) ||
    'wyn';

  const configPath = getConfigPath(resolvedConfigName);

  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw new Error(`Could not read collections config at ${configPath}: ${error}`);
  }

  let config: CollectionsConfig;
  try {
    config = yaml.load(content) as CollectionsConfig;
  } catch (error) {
    throw new Error(`Failed to parse collections config YAML: ${error}`);
  }

  // Load tagging spec for validation
  let spec: ParsedTaggingSpec;
  try {
    spec = loadParsedTaggingSpec();
  } catch (error) {
    console.warn(`Warning: Could not load tagging spec for validation: ${error}`);
    // Create a minimal spec for basic validation
    spec = {
      allowedDimensions: ['pillar', 'family', 'brand', 'material', 'format', 'use', 'style', 'joint_size', 'joint_angle', 'joint_gender', 'length', 'capacity', 'bundle'],
      allowedPillars: [],
      allowedFamilies: [],
      allowedBrands: [],
      allowedMaterials: [],
      allowedFormats: [],
      allowedUses: [],
      allowedStyles: []
    };
  }

  // Validate all collections
  const allHandles = new Set<string>();
  const allErrors: string[] = [];

  if (!config.collections || !Array.isArray(config.collections)) {
    throw new Error('Collections config must have a "collections" array');
  }

  config.collections.forEach((entry, index) => {
    const errors = validateCollectionEntry(entry, index, allHandles, spec);
    allErrors.push(...errors);
  });

  if (allErrors.length > 0) {
    throw new Error(`Collections config validation failed:\n${allErrors.map(e => `  - ${e}`).join('\n')}`);
  }

  return config;
}

/**
 * Get a collection by handle
 */
export function getCollectionByHandle(config: CollectionsConfig, handle: string): CollectionConfigEntry | undefined {
  return config.collections.find(c => c.handle === handle);
}

/**
 * Get collections by group
 */
export function getCollectionsByGroup(config: CollectionsConfig, group: string): CollectionConfigEntry[] {
  return config.collections.filter(c => c.group === group);
}

/**
 * Build a map of handle -> collection config for quick lookup
 */
export function buildCollectionHandleMap(config: CollectionsConfig): Map<string, CollectionConfigEntry> {
  const map = new Map<string, CollectionConfigEntry>();
  config.collections.forEach(c => map.set(c.handle, c));
  return map;
}

/**
 * Generate a human-readable summary of a collection's rules
 */
export function summarizeCollectionRules(collection: CollectionConfigEntry): string {
  if (!collection.smart_rules || !collection.smart_rules.conditions.length) {
    return 'No rules';
  }

  const rules = collection.smart_rules.conditions.map(c => c.value);
  const joiner = collection.smart_rules.appliedDisjunctively ? ' OR ' : ' AND ';
  return rules.join(joiner);
}
