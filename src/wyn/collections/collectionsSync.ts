/**
 * Collections Sync Module
 * Syncs collection configuration to Shopify Admin
 */

import type { CollectionsConfig, CollectionConfigEntry, CollectionSyncPlan, ShopifyCollection } from '../../types.js';
import {
  getCollectionByHandle,
  createCollection,
  updateCollection,
  compareRuleSets,
  determineCollectionChanges
} from '../../shopify/collectionsApi.js';
import { publishCollectionToOnlineStore } from '../../shopify/publicationsApi.js';
import { summarizeCollectionRules } from '../../config/collectionsConfig.js';
import { estimateCollectionCounts } from '../tags/tagAudit.js';

/**
 * Plan the sync operations for all collections
 */
export async function planCollectionsSync(config: CollectionsConfig): Promise<CollectionSyncPlan[]> {
  const plans: CollectionSyncPlan[] = [];

  for (const collection of config.collections) {
    const plan = await planSingleCollectionSync(collection);
    plans.push(plan);
  }

  return plans;
}

/**
 * Plan sync for a single collection
 */
async function planSingleCollectionSync(collection: CollectionConfigEntry): Promise<CollectionSyncPlan> {
  const ruleSummary = summarizeCollectionRules(collection);

  try {
    const existing = await getCollectionByHandle(collection.handle);

    if (!existing) {
      return {
        handle: collection.handle,
        title: collection.title,
        action: 'create',
        ruleSummary
      };
    }

    // Check if update is needed
    const changes = determineCollectionChanges(existing, collection);

    if (changes.length === 0) {
      return {
        handle: collection.handle,
        title: collection.title,
        action: 'noop',
        ruleSummary,
        existingId: existing.id
      };
    }

    return {
      handle: collection.handle,
      title: collection.title,
      action: 'update',
      ruleSummary,
      existingId: existing.id,
      changes
    };
  } catch (error) {
    // If we can't check, assume create
    console.warn(`Warning: Could not check existing collection "${collection.handle}": ${error}`);
    return {
      handle: collection.handle,
      title: collection.title,
      action: 'create',
      ruleSummary
    };
  }
}

/**
 * Execute the sync plan
 */
export async function executeCollectionsSync(
  config: CollectionsConfig,
  plans: CollectionSyncPlan[],
  options: { publish?: boolean } = {}
): Promise<{
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ handle: string; error: string }>;
}> {
  const results = {
    created: [] as string[],
    updated: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{ handle: string; error: string }>
  };

  for (const plan of plans) {
    const collectionConfig = config.collections.find(c => c.handle === plan.handle);
    if (!collectionConfig) {
      results.errors.push({ handle: plan.handle, error: 'Config not found' });
      continue;
    }

    try {
      switch (plan.action) {
        case 'create': {
          console.log(`Creating collection: ${plan.handle}`);
          const created = await createCollection(collectionConfig);
          results.created.push(plan.handle);

          // Publish to Online Store if requested
          if (options.publish && created.id) {
            try {
              await publishCollectionToOnlineStore(created.id);
              console.log(`  Published to Online Store`);
            } catch (pubError) {
              console.warn(`  Warning: Could not publish: ${pubError}`);
            }
          }
          break;
        }

        case 'update': {
          if (!plan.existingId) {
            results.errors.push({ handle: plan.handle, error: 'No existing ID for update' });
            continue;
          }
          console.log(`Updating collection: ${plan.handle}`);
          await updateCollection(plan.existingId, collectionConfig);
          results.updated.push(plan.handle);
          break;
        }

        case 'noop':
          results.skipped.push(plan.handle);
          break;
      }
    } catch (error) {
      results.errors.push({
        handle: plan.handle,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

/**
 * Format sync plan as a human-readable report
 */
export function formatSyncPlanReport(plans: CollectionSyncPlan[]): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('COLLECTIONS SYNC PLAN');
  lines.push('='.repeat(70));
  lines.push('');

  // Group by action
  const creates = plans.filter(p => p.action === 'create');
  const updates = plans.filter(p => p.action === 'update');
  const noops = plans.filter(p => p.action === 'noop');

  lines.push(`Summary: ${creates.length} to create, ${updates.length} to update, ${noops.length} up to date`);
  lines.push('');

  if (creates.length > 0) {
    lines.push('WILL CREATE:');
    lines.push('-'.repeat(50));
    for (const plan of creates) {
      lines.push(`  ${plan.handle}`);
      lines.push(`    Title: ${plan.title}`);
      lines.push(`    Rules: ${plan.ruleSummary}`);
    }
    lines.push('');
  }

  if (updates.length > 0) {
    lines.push('WILL UPDATE:');
    lines.push('-'.repeat(50));
    for (const plan of updates) {
      lines.push(`  ${plan.handle}`);
      if (plan.changes && plan.changes.length > 0) {
        for (const change of plan.changes) {
          lines.push(`    - ${change}`);
        }
      }
    }
    lines.push('');
  }

  if (noops.length > 0) {
    lines.push('UP TO DATE (no changes):');
    lines.push('-'.repeat(50));
    for (const plan of noops) {
      lines.push(`  ${plan.handle}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(70));
  lines.push('Run with --apply to execute these changes');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

/**
 * Format sync results as a human-readable report
 */
export function formatSyncResultsReport(results: {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ handle: string; error: string }>;
}): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('COLLECTIONS SYNC RESULTS');
  lines.push('='.repeat(70));
  lines.push('');

  lines.push(`Created: ${results.created.length}`);
  for (const handle of results.created) {
    lines.push(`  + ${handle}`);
  }

  lines.push(`Updated: ${results.updated.length}`);
  for (const handle of results.updated) {
    lines.push(`  ~ ${handle}`);
  }

  lines.push(`Skipped: ${results.skipped.length}`);

  if (results.errors.length > 0) {
    lines.push(`Errors: ${results.errors.length}`);
    for (const { handle, error } of results.errors) {
      lines.push(`  ! ${handle}: ${error}`);
    }
  }

  lines.push('');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

/**
 * Compare estimated vs actual product counts (QA check)
 */
export async function compareProductCounts(
  config: CollectionsConfig
): Promise<Array<{
  handle: string;
  estimated: number;
  actual: number | null;
  mismatch: boolean;
}>> {
  // Get estimated counts from CSV
  const estimated = estimateCollectionCounts(config.collections);

  const comparisons: Array<{
    handle: string;
    estimated: number;
    actual: number | null;
    mismatch: boolean;
  }> = [];

  for (const collection of config.collections) {
    try {
      const existing = await getCollectionByHandle(collection.handle);
      const actualCount = existing?.productsCount?.count ?? null;
      const estimatedCount = estimated.get(collection.handle) || 0;

      // Consider significant if difference is > 10% or > 5 products
      const mismatch = actualCount !== null &&
        Math.abs(actualCount - estimatedCount) > Math.max(5, estimatedCount * 0.1);

      comparisons.push({
        handle: collection.handle,
        estimated: estimatedCount,
        actual: actualCount,
        mismatch
      });
    } catch {
      comparisons.push({
        handle: collection.handle,
        estimated: estimated.get(collection.handle) || 0,
        actual: null,
        mismatch: false
      });
    }
  }

  return comparisons;
}

/**
 * Format product count comparison report
 */
export function formatCountComparisonReport(
  comparisons: Array<{
    handle: string;
    estimated: number;
    actual: number | null;
    mismatch: boolean;
  }>
): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('PRODUCT COUNT COMPARISON (Expected vs Actual)');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`${'Handle'.padEnd(35)} ${'Expected'.padStart(10)} ${'Actual'.padStart(10)} Status`);
  lines.push('-'.repeat(70));

  const mismatches = comparisons.filter(c => c.mismatch);

  for (const comp of comparisons) {
    const actualStr = comp.actual !== null ? String(comp.actual) : 'N/A';
    const status = comp.mismatch ? '*** MISMATCH' : comp.actual === null ? '(not synced)' : 'OK';
    lines.push(
      `${comp.handle.padEnd(35)} ${String(comp.estimated).padStart(10)} ${actualStr.padStart(10)} ${status}`
    );
  }

  lines.push('');
  if (mismatches.length > 0) {
    lines.push(`WARNING: ${mismatches.length} collections have significant count mismatches`);
  } else {
    lines.push('All synced collections have matching product counts');
  }

  lines.push('='.repeat(70));

  return lines.join('\n');
}
