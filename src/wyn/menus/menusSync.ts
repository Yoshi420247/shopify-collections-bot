/**
 * Menus Sync Module
 * Syncs menu configuration to Shopify Admin
 */

import type { MenusConfig, MenuConfigEntry, MenuSyncPlan, CollectionsConfig } from '../../types.js';
import {
  getMenuByHandle,
  createMenu,
  updateMenu,
  countShopifyMenuItems,
  printExistingMenuStructure
} from '../../shopify/menusApi.js';
import { getCollectionByHandle } from '../../shopify/collectionsApi.js';
import { collectTargetHandles, countMenuItems, printMenuStructure } from '../../config/menusConfig.js';

/**
 * Resolve collection handles to Shopify resource IDs
 */
export async function resolveCollectionHandles(
  handles: string[]
): Promise<{
  idByHandle: Map<string, string>;
  missing: string[];
}> {
  const idByHandle = new Map<string, string>();
  const missing: string[] = [];

  for (const handle of handles) {
    try {
      const collection = await getCollectionByHandle(handle);
      if (collection) {
        idByHandle.set(handle, collection.id);
      } else {
        missing.push(handle);
      }
    } catch (error) {
      console.warn(`Warning: Could not resolve collection "${handle}": ${error}`);
      missing.push(handle);
    }
  }

  return { idByHandle, missing };
}

/**
 * Plan sync for a single menu
 */
async function planSingleMenuSync(
  menu: MenuConfigEntry,
  collectionIdByHandle: Map<string, string>,
  missingHandles: string[]
): Promise<MenuSyncPlan> {
  const itemCount = countMenuItems(menu.items);

  // Check for missing collections
  const menuHandles = collectTargetHandles(menu.items);
  const missingInMenu = menuHandles.filter(h => missingHandles.includes(h));

  if (missingInMenu.length > 0) {
    return {
      handle: menu.handle,
      title: menu.title,
      action: 'noop',
      itemCount,
      changes: [`BLOCKED: Missing collections: ${missingInMenu.join(', ')}`]
    };
  }

  try {
    const existing = await getMenuByHandle(menu.handle);

    if (!existing) {
      return {
        handle: menu.handle,
        title: menu.title,
        action: 'create',
        itemCount
      };
    }

    // For menus, we always update since comparing nested structures is complex
    // and the update operation is idempotent
    const existingItemCount = countShopifyMenuItems(existing.items);

    return {
      handle: menu.handle,
      title: menu.title,
      action: 'update',
      existingId: existing.id,
      itemCount,
      changes: [
        `Existing items: ${existingItemCount}, Config items: ${itemCount}`,
        'Will replace all menu items with config'
      ]
    };
  } catch (error) {
    console.warn(`Warning: Could not check existing menu "${menu.handle}": ${error}`);
    return {
      handle: menu.handle,
      title: menu.title,
      action: 'create',
      itemCount
    };
  }
}

/**
 * Plan the sync operations for all menus
 */
export async function planMenusSync(
  config: MenusConfig,
  collectionsConfig: CollectionsConfig
): Promise<{
  plans: MenuSyncPlan[];
  collectionIdByHandle: Map<string, string>;
  missingCollections: string[];
}> {
  // Gather all collection handles needed by all menus
  const allHandles = new Set<string>();
  for (const menu of config.menus) {
    const handles = collectTargetHandles(menu.items);
    handles.forEach(h => allHandles.add(h));
  }

  // Resolve handles to IDs
  const { idByHandle, missing } = await resolveCollectionHandles([...allHandles]);

  if (missing.length > 0) {
    console.warn(`Warning: ${missing.length} collections not found in Shopify:`);
    missing.forEach(h => console.warn(`  - ${h}`));
    console.warn('These must be synced before menu items can reference them.');
  }

  // Plan each menu
  const plans: MenuSyncPlan[] = [];
  for (const menu of config.menus) {
    const plan = await planSingleMenuSync(menu, idByHandle, missing);
    plans.push(plan);
  }

  return {
    plans,
    collectionIdByHandle: idByHandle,
    missingCollections: missing
  };
}

/**
 * Execute the sync plan
 */
export async function executeMenusSync(
  config: MenusConfig,
  plans: MenuSyncPlan[],
  collectionIdByHandle: Map<string, string>
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
    const menuConfig = config.menus.find(m => m.handle === plan.handle);
    if (!menuConfig) {
      results.errors.push({ handle: plan.handle, error: 'Config not found' });
      continue;
    }

    // Check if blocked
    if (plan.changes?.some(c => c.startsWith('BLOCKED'))) {
      results.errors.push({
        handle: plan.handle,
        error: plan.changes.find(c => c.startsWith('BLOCKED')) || 'Blocked'
      });
      continue;
    }

    try {
      switch (plan.action) {
        case 'create': {
          console.log(`Creating menu: ${plan.handle}`);
          await createMenu(
            menuConfig.handle,
            menuConfig.title,
            menuConfig.items,
            collectionIdByHandle
          );
          results.created.push(plan.handle);
          break;
        }

        case 'update': {
          if (!plan.existingId) {
            results.errors.push({ handle: plan.handle, error: 'No existing ID for update' });
            continue;
          }
          console.log(`Updating menu: ${plan.handle}`);
          await updateMenu(
            plan.existingId,
            menuConfig.title,
            menuConfig.items,
            collectionIdByHandle
          );
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
export function formatMenuSyncPlanReport(
  plans: MenuSyncPlan[],
  missingCollections: string[]
): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('MENUS SYNC PLAN');
  lines.push('='.repeat(70));
  lines.push('');

  if (missingCollections.length > 0) {
    lines.push('WARNING: Missing Collections');
    lines.push('-'.repeat(50));
    lines.push('The following collections must be created before syncing menus:');
    for (const handle of missingCollections) {
      lines.push(`  - ${handle}`);
    }
    lines.push('');
    lines.push('Run: npm run wyn:sync-collections -- --apply');
    lines.push('');
  }

  // Group by action
  const creates = plans.filter(p => p.action === 'create');
  const updates = plans.filter(p => p.action === 'update');
  const blocked = plans.filter(p => p.changes?.some(c => c.startsWith('BLOCKED')));
  const noops = plans.filter(p => p.action === 'noop' && !p.changes?.some(c => c.startsWith('BLOCKED')));

  lines.push(`Summary: ${creates.length} to create, ${updates.length} to update, ${blocked.length} blocked, ${noops.length} up to date`);
  lines.push('');

  if (blocked.length > 0) {
    lines.push('BLOCKED (missing collections):');
    lines.push('-'.repeat(50));
    for (const plan of blocked) {
      lines.push(`  ${plan.handle}`);
      if (plan.changes) {
        for (const change of plan.changes) {
          lines.push(`    ${change}`);
        }
      }
    }
    lines.push('');
  }

  if (creates.length > 0) {
    lines.push('WILL CREATE:');
    lines.push('-'.repeat(50));
    for (const plan of creates) {
      lines.push(`  ${plan.handle} (${plan.itemCount} items)`);
    }
    lines.push('');
  }

  if (updates.length > 0) {
    lines.push('WILL UPDATE:');
    lines.push('-'.repeat(50));
    for (const plan of updates) {
      lines.push(`  ${plan.handle} (${plan.itemCount} items)`);
      if (plan.changes) {
        for (const change of plan.changes) {
          lines.push(`    ${change}`);
        }
      }
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
export function formatMenuSyncResultsReport(results: {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ handle: string; error: string }>;
}): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('MENUS SYNC RESULTS');
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
 * Show existing vs desired menu structure for comparison
 */
export async function compareMenuStructures(
  config: MenusConfig
): Promise<string> {
  const lines: string[] = [];

  for (const menu of config.menus) {
    lines.push('='.repeat(70));
    lines.push(`MENU: ${menu.handle}`);
    lines.push('='.repeat(70));
    lines.push('');

    try {
      const existing = await getMenuByHandle(menu.handle);
      if (existing) {
        lines.push('CURRENT (in Shopify):');
        lines.push(printExistingMenuStructure(existing));
      } else {
        lines.push('CURRENT: Not found in Shopify');
      }
    } catch {
      lines.push('CURRENT: Unable to fetch');
    }

    lines.push('');
    lines.push('DESIRED (from config):');
    lines.push(printMenuStructure(menu));
    lines.push('');
  }

  return lines.join('\n');
}
