/**
 * Shopify Collections API
 * CRUD operations for Shopify collections via Admin GraphQL API
 */

import { shopifyAdminRequest, checkUserErrors, type UserError } from './graphqlClient.js';
import type { ShopifyCollection, CollectionConfigEntry, SmartRuleCondition } from '../types.js';

// ===========================================
// GRAPHQL QUERIES
// ===========================================

const GET_COLLECTION_BY_HANDLE = `
  query GetCollectionByHandle($handle: String!) {
    collectionByHandle(handle: $handle) {
      id
      handle
      title
      descriptionHtml
      sortOrder
      ruleSet {
        appliedDisjunctively
        rules {
          column
          relation
          condition
        }
      }
      productsCount {
        count
      }
    }
  }
`;

const GET_COLLECTION_BY_ID = `
  query GetCollectionById($id: ID!) {
    collection(id: $id) {
      id
      handle
      title
      descriptionHtml
      sortOrder
      ruleSet {
        appliedDisjunctively
        rules {
          column
          relation
          condition
        }
      }
      productsCount {
        count
      }
    }
  }
`;

const CREATE_COLLECTION = `
  mutation CollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection {
        id
        handle
        title
        descriptionHtml
        sortOrder
        ruleSet {
          appliedDisjunctively
          rules {
            column
            relation
            condition
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_COLLECTION = `
  mutation CollectionUpdate($input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection {
        id
        handle
        title
        descriptionHtml
        sortOrder
        ruleSet {
          appliedDisjunctively
          rules {
            column
            relation
            condition
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ===========================================
// TYPE MAPPINGS
// ===========================================

/**
 * Map internal field names to Shopify CollectionRuleColumn enum values
 */
function mapFieldToShopifyColumn(field: string): string {
  const mapping: Record<string, string> = {
    'TAG': 'TAG',
    'VENDOR': 'VENDOR',
    'PRODUCT_TYPE': 'TYPE',
    'VARIANT_PRICE': 'VARIANT_PRICE',
    'VARIANT_COMPARE_AT_PRICE': 'VARIANT_COMPARE_AT_PRICE',
    'VARIANT_WEIGHT': 'VARIANT_WEIGHT',
    'VARIANT_INVENTORY': 'VARIANT_INVENTORY_QTY',
    'VARIANT_TITLE': 'VARIANT_TITLE'
  };
  return mapping[field] || field;
}

/**
 * Map internal relation names to Shopify CollectionRuleRelation enum values
 */
function mapRelationToShopify(relation: string): string {
  const mapping: Record<string, string> = {
    'EQUALS': 'EQUALS',
    'NOT_EQUALS': 'NOT_EQUALS',
    'GREATER_THAN': 'GREATER_THAN',
    'LESS_THAN': 'LESS_THAN',
    'STARTS_WITH': 'STARTS_WITH',
    'ENDS_WITH': 'ENDS_WITH',
    'CONTAINS': 'CONTAINS',
    'NOT_CONTAINS': 'NOT_CONTAINS'
  };
  return mapping[relation] || relation;
}

/**
 * Map internal sort order to Shopify CollectionSortOrder enum
 */
function mapSortOrderToShopify(sortOrder?: string): string | undefined {
  if (!sortOrder) return undefined;

  const mapping: Record<string, string> = {
    'ALPHA_ASC': 'ALPHA_ASC',
    'ALPHA_DESC': 'ALPHA_DESC',
    'BEST_SELLING': 'BEST_SELLING',
    'CREATED': 'CREATED',
    'CREATED_DESC': 'CREATED_DESC',
    'MANUAL': 'MANUAL',
    'PRICE_ASC': 'PRICE_ASC',
    'PRICE_DESC': 'PRICE_DESC'
  };
  return mapping[sortOrder] || sortOrder;
}

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get a collection by its handle
 */
export async function getCollectionByHandle(handle: string): Promise<ShopifyCollection | null> {
  interface Response {
    collectionByHandle: ShopifyCollection | null;
  }

  const data = await shopifyAdminRequest<Response>(
    GET_COLLECTION_BY_HANDLE,
    { handle },
    'GetCollectionByHandle'
  );

  return data.collectionByHandle;
}

/**
 * Get a collection by its ID
 */
export async function getCollectionById(id: string): Promise<ShopifyCollection | null> {
  interface Response {
    collection: ShopifyCollection | null;
  }

  const data = await shopifyAdminRequest<Response>(
    GET_COLLECTION_BY_ID,
    { id },
    'GetCollectionById'
  );

  return data.collection;
}

/**
 * Build the CollectionInput from our config entry
 */
export function buildCollectionInput(
  config: CollectionConfigEntry,
  existingId?: string
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    title: config.title,
    handle: config.handle,
    descriptionHtml: config.description || ''
  };

  // Add ID for updates
  if (existingId) {
    input.id = existingId;
  }

  // Add sort order if specified
  const sortOrder = mapSortOrderToShopify(config.sort_order);
  if (sortOrder) {
    input.sortOrder = sortOrder;
  }

  // Build ruleSet for SMART collections
  if (config.type === 'SMART' && config.smart_rules) {
    const rules = config.smart_rules.conditions.map(condition => ({
      column: mapFieldToShopifyColumn(condition.field),
      relation: mapRelationToShopify(condition.relation),
      condition: condition.value
    }));

    input.ruleSet = {
      appliedDisjunctively: config.smart_rules.appliedDisjunctively,
      rules
    };
  }

  return input;
}

/**
 * Create a new collection
 */
export async function createCollection(config: CollectionConfigEntry): Promise<ShopifyCollection> {
  interface Response {
    collectionCreate: {
      collection: ShopifyCollection | null;
      userErrors: UserError[];
    };
  }

  const input = buildCollectionInput(config);

  const data = await shopifyAdminRequest<Response>(
    CREATE_COLLECTION,
    { input },
    'CollectionCreate'
  );

  checkUserErrors(data.collectionCreate, 'CollectionCreate');

  if (!data.collectionCreate.collection) {
    throw new Error('Collection creation returned no collection');
  }

  return data.collectionCreate.collection;
}

/**
 * Update an existing collection
 */
export async function updateCollection(id: string, config: CollectionConfigEntry): Promise<ShopifyCollection> {
  interface Response {
    collectionUpdate: {
      collection: ShopifyCollection | null;
      userErrors: UserError[];
    };
  }

  const input = buildCollectionInput(config, id);

  const data = await shopifyAdminRequest<Response>(
    UPDATE_COLLECTION,
    { input },
    'CollectionUpdate'
  );

  checkUserErrors(data.collectionUpdate, 'CollectionUpdate');

  if (!data.collectionUpdate.collection) {
    throw new Error('Collection update returned no collection');
  }

  return data.collectionUpdate.collection;
}

/**
 * Compare two rule sets to determine if they are equivalent
 */
export function compareRuleSets(
  existing: ShopifyCollection['ruleSet'],
  config: CollectionConfigEntry
): boolean {
  // If both have no rules, they match
  if (!existing && (!config.smart_rules || config.smart_rules.conditions.length === 0)) {
    return true;
  }

  // If one has rules and the other doesn't, they don't match
  if (!existing || !config.smart_rules) {
    return false;
  }

  // Compare disjunctive setting
  if (existing.appliedDisjunctively !== config.smart_rules.appliedDisjunctively) {
    return false;
  }

  // Compare rule counts
  if (existing.rules.length !== config.smart_rules.conditions.length) {
    return false;
  }

  // Compare each rule (order independent)
  const existingSet = new Set(
    existing.rules.map(r => `${r.column}|${r.relation}|${r.condition}`)
  );

  const configSet = new Set(
    config.smart_rules.conditions.map(c =>
      `${mapFieldToShopifyColumn(c.field)}|${mapRelationToShopify(c.relation)}|${c.value}`
    )
  );

  // Check if all config rules exist in existing
  for (const rule of configSet) {
    if (!existingSet.has(rule)) {
      return false;
    }
  }

  return true;
}

/**
 * Determine what changes would be needed to update a collection
 */
export function determineCollectionChanges(
  existing: ShopifyCollection,
  config: CollectionConfigEntry
): string[] {
  const changes: string[] = [];

  if (existing.title !== config.title) {
    changes.push(`Title: "${existing.title}" -> "${config.title}"`);
  }

  const configSortOrder = mapSortOrderToShopify(config.sort_order);
  if (configSortOrder && existing.sortOrder !== configSortOrder) {
    changes.push(`Sort order: "${existing.sortOrder}" -> "${configSortOrder}"`);
  }

  if (!compareRuleSets(existing.ruleSet, config)) {
    changes.push('Rule set differs');
  }

  return changes;
}
