/**
 * Shared types for the WYN Collections & Menus automation system
 */

// ===========================================
// TAGGING SPEC TYPES
// ===========================================

export interface TaggingSpec {
  spec_name: string;
  version: string;
  last_updated: string;
  context: string;
  input_schema: string;
  tag_dimensions: string;
  product_family_rules: string;
  collections: string;
  llm_workflow: string;
  examples: string;
}

export interface ParsedTaggingSpec {
  allowedDimensions: string[];
  allowedFamilies: string[];
  allowedBrands: string[];
  allowedMaterials: string[];
  allowedFormats: string[];
  allowedUses: string[];
  allowedStyles: string[];
  allowedPillars: string[];
}

// ===========================================
// COLLECTIONS CONFIG TYPES
// ===========================================

export type CollectionGroup = 'devices' | 'accessories' | 'brands' | 'themes' | 'merch' | 'misc';
export type CollectionType = 'SMART' | 'MANUAL';
export type SortOrder = 'ALPHA_ASC' | 'ALPHA_DESC' | 'BEST_SELLING' | 'CREATED' | 'CREATED_DESC' | 'MANUAL' | 'PRICE_ASC' | 'PRICE_DESC';

export interface SmartRuleCondition {
  field: 'TAG' | 'VENDOR' | 'PRODUCT_TYPE' | 'VARIANT_PRICE' | 'VARIANT_COMPARE_AT_PRICE' | 'VARIANT_WEIGHT' | 'VARIANT_INVENTORY' | 'VARIANT_TITLE';
  relation: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'STARTS_WITH' | 'ENDS_WITH' | 'CONTAINS' | 'NOT_CONTAINS';
  value: string;
}

export interface SmartRules {
  appliedDisjunctively: boolean;
  conditions: SmartRuleCondition[];
}

export interface VendorFilter {
  enabled: boolean;
}

export interface CollectionConfigEntry {
  key: string;
  title: string;
  handle: string;
  group: CollectionGroup;
  description: string;
  type: CollectionType;
  sort_order?: SortOrder;
  smart_rules: SmartRules;
  vendor_filter: VendorFilter;
  exclude_conditions: SmartRuleCondition[];
}

export interface CollectionsConfig {
  version: string;
  vendor: string;
  collections: CollectionConfigEntry[];
}

// ===========================================
// MENUS CONFIG TYPES
// ===========================================

export type MenuItemType = 'COLLECTION' | 'PRODUCT' | 'PAGE' | 'BLOG' | 'LINK' | 'CATALOG';

export interface MenuItemConfigEntry {
  title: string;
  type: MenuItemType;
  target_collection_handle?: string;
  url?: string;
  children?: MenuItemConfigEntry[];
}

export interface MenuConfigEntry {
  handle: string;
  title: string;
  items: MenuItemConfigEntry[];
}

export interface MenusConfig {
  version: string;
  menus: MenuConfigEntry[];
  cleanup_menus?: string[];  // Handles of menus to delete (duplicates/old menus)
}

// ===========================================
// SHOPIFY API TYPES
// ===========================================

export interface ShopifyCollection {
  id: string;
  handle: string;
  title: string;
  descriptionHtml?: string;
  sortOrder?: string;
  ruleSet?: {
    appliedDisjunctively: boolean;
    rules: Array<{
      column: string;
      relation: string;
      condition: string;
    }>;
  };
  productsCount?: {
    count: number;
  };
}

export interface ShopifyMenu {
  id: string;
  handle: string;
  title: string;
  items: ShopifyMenuItem[];
}

export interface ShopifyMenuItem {
  id: string;
  title: string;
  type: string;
  resourceId?: string;
  url?: string;
  items: ShopifyMenuItem[];
}

export interface ShopifyPublication {
  id: string;
  name: string;
}

// ===========================================
// SYNC TYPES
// ===========================================

export type SyncAction = 'create' | 'update' | 'noop';

export interface CollectionSyncPlan {
  handle: string;
  title: string;
  action: SyncAction;
  ruleSummary: string;
  existingId?: string;
  changes?: string[];
}

export interface MenuSyncPlan {
  handle: string;
  title: string;
  action: SyncAction;
  existingId?: string;
  itemCount: number;
  changes?: string[];
}

// ===========================================
// TAG AUDIT TYPES
// ===========================================

export interface ProductTagData {
  handle: string;
  title: string;
  vendor: string;
  type: string;
  tags: string[];
}

export interface TagAuditError {
  handle: string;
  title: string;
  errorType: 'missing_pillar' | 'missing_family' | 'missing_format' | 'missing_use' |
             'multiple_pillars' | 'multiple_families' | 'multiple_formats' |
             'unknown_dimension' | 'unknown_value';
  message: string;
  tags: string[];
}

export interface TagAuditSummary {
  totalProducts: number;
  validProducts: number;
  errorCount: number;
  pillarCounts: Record<string, number>;
  familyCounts: Record<string, number>;
  brandCounts: Record<string, number>;
  errors: TagAuditError[];
}
