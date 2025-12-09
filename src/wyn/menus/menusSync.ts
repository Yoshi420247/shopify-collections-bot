/**
 * Menus Sync Module
 * Syncs menu configuration to Shopify Admin
 */

import type { MenusConfig, MenuConfigEntry, MenuSyncPlan, CollectionsConfig, ShopifyMenuItem } from '../../types.js';
import {
  getMenuByHandle,
  getMenus,
  createMenu,
  updateMenu,
  countShopifyMenuItems,
  printExistingMenuStructure
} from '../../shopify/menusApi.js';
import { getCollectionByHandle } from '../../shopify/collectionsApi.js';
import { collectTargetHandles, countMenuItems, printMenuStructure } from '../../config/menusConfig.js';
import { upsertUrlRedirect, getUrlRedirects } from '../../shopify/redirectsApi.js';
import {
  generateMenuReplacementPlan,
  findOrphanedMenus,
  findEmptyCollectionsInMenus,
  auditMenu
} from './menuCleanup.js';

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

// ===========================================
// ENHANCED SYNC WITH REDIRECTS (SEO-SAFE)
// ===========================================

/**
 * Extract all collection URLs from current menu items
 */
function extractCollectionUrls(items: ShopifyMenuItem[]): Map<string, string> {
  const urls = new Map<string, string>();

  function traverse(items: ShopifyMenuItem[]) {
    for (const item of items) {
      if (item.type === 'COLLECTION' && item.url) {
        const handleMatch = item.url.match(/\/collections\/([^/?]+)/);
        if (handleMatch) {
          urls.set(handleMatch[1], item.title);
        }
      }
      if (item.items && item.items.length > 0) {
        traverse(item.items);
      }
    }
  }

  traverse(items);
  return urls;
}

/**
 * Extract collection handles from config items
 */
function extractConfigHandles(items: MenuConfigEntry['items']): Set<string> {
  const handles = new Set<string>();

  function traverse(items: MenuConfigEntry['items']) {
    for (const item of items) {
      if (item.type === 'COLLECTION' && item.target_collection_handle) {
        handles.add(item.target_collection_handle);
      }
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(items);
  return handles;
}

/**
 * Plan and execute SEO-safe menu replacement with automatic redirects
 */
export async function executeSeoSafeMenuSync(
  config: MenusConfig,
  plans: MenuSyncPlan[],
  collectionIdByHandle: Map<string, string>,
  options: {
    createRedirects: boolean;
    defaultRedirectTarget: string;
  } = {
    createRedirects: true,
    defaultRedirectTarget: '/collections/shop-all-what-you-need'
  }
): Promise<{
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ handle: string; error: string }>;
  redirectsCreated: Array<{ path: string; target: string }>;
  redirectErrors: Array<{ path: string; error: string }>;
}> {
  const results = {
    created: [] as string[],
    updated: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{ handle: string; error: string }>,
    redirectsCreated: [] as Array<{ path: string; target: string }>,
    redirectErrors: [] as Array<{ path: string; error: string }>
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
      // For updates, first analyze what collection links are being removed
      if (plan.action === 'update' && plan.existingId && options.createRedirects) {
        const existingMenu = await getMenuByHandle(plan.handle);
        if (existingMenu) {
          const currentUrls = extractCollectionUrls(existingMenu.items);
          const newHandles = extractConfigHandles(menuConfig.items);

          // Find collections that exist in current menu but not in new config
          for (const [handle, title] of currentUrls) {
            if (!newHandles.has(handle)) {
              // This collection link is being removed - create redirect
              const path = `/collections/${handle}`;
              const target = options.defaultRedirectTarget;

              console.log(`  Creating redirect: ${path} -> ${target} (removing "${title}")`);

              try {
                const { action } = await upsertUrlRedirect(path, target);
                if (action !== 'unchanged') {
                  results.redirectsCreated.push({ path, target });
                }
              } catch (error) {
                results.redirectErrors.push({
                  path,
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
        }
      }

      // Now perform the menu operation
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
 * Comprehensive menu audit report
 */
export async function generateMenuAuditReport(
  config: MenusConfig
): Promise<string> {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('COMPREHENSIVE MENU AUDIT REPORT');
  lines.push('='.repeat(70));
  lines.push('');

  // 1. Check for orphaned menus
  lines.push('1. ORPHANED MENUS');
  lines.push('-'.repeat(50));
  const configuredHandles = config.menus.map(m => m.handle);
  const orphaned = await findOrphanedMenus(configuredHandles);

  if (orphaned.length === 0) {
    lines.push('  No orphaned menus found.');
  } else {
    for (const menu of orphaned) {
      lines.push(`  - ${menu.handle} (${menu.title})`);
      lines.push(`    Items: ${menu.itemsCount}, Reason: ${menu.reason}`);
    }
  }
  lines.push('');

  // 2. Check for empty collections in menus
  lines.push('2. EMPTY COLLECTIONS IN MENUS');
  lines.push('-'.repeat(50));
  const emptyCollections = await findEmptyCollectionsInMenus();

  if (emptyCollections.length === 0) {
    lines.push('  No empty collections found in any menu.');
  } else {
    for (const menuResult of emptyCollections) {
      lines.push(`  Menu: ${menuResult.menu}`);
      for (const item of menuResult.items) {
        lines.push(`    - "${item.title}" -> ${item.collectionHandle} (0 products)`);
      }
    }
  }
  lines.push('');

  // 3. Audit each configured menu
  lines.push('3. MENU HEALTH CHECKS');
  lines.push('-'.repeat(50));
  for (const menu of config.menus) {
    const audit = await auditMenu(menu.handle);
    if (!audit) {
      lines.push(`  ${menu.handle}: NOT FOUND IN SHOPIFY`);
      continue;
    }

    const errorCount = audit.issues.filter(i => i.severity === 'error').length;
    const warningCount = audit.issues.filter(i => i.severity === 'warning').length;

    lines.push(`  ${menu.handle}: ${audit.menu.itemsCount} items, ${errorCount} errors, ${warningCount} warnings`);

    if (audit.issues.length > 0) {
      for (const issue of audit.issues) {
        const icon = issue.severity === 'error' ? '!' : issue.severity === 'warning' ? '?' : 'i';
        lines.push(`    [${icon}] ${issue.message}`);
      }
    }
  }
  lines.push('');

  // 4. Existing redirects summary
  lines.push('4. EXISTING URL REDIRECTS (Collections)');
  lines.push('-'.repeat(50));
  try {
    const redirects = await getUrlRedirects(100, 'path:/collections/*');
    if (redirects.length === 0) {
      lines.push('  No collection redirects found.');
    } else {
      lines.push(`  Found ${redirects.length} collection redirects:`);
      for (const redirect of redirects.slice(0, 20)) {
        lines.push(`    ${redirect.path} -> ${redirect.target}`);
      }
      if (redirects.length > 20) {
        lines.push(`    ... and ${redirects.length - 20} more`);
      }
    }
  } catch {
    lines.push('  Unable to fetch redirects (may need read_url_redirects scope)');
  }
  lines.push('');

  lines.push('='.repeat(70));
  lines.push('END OF AUDIT REPORT');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

/**
 * Format enhanced sync results report
 */
export function formatEnhancedSyncResultsReport(results: {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ handle: string; error: string }>;
  redirectsCreated: Array<{ path: string; target: string }>;
  redirectErrors: Array<{ path: string; error: string }>;
}): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('SEO-SAFE MENUS SYNC RESULTS');
  lines.push('='.repeat(70));
  lines.push('');

  // Menu operations
  lines.push('MENU OPERATIONS:');
  lines.push(`  Created: ${results.created.length}`);
  for (const handle of results.created) {
    lines.push(`    + ${handle}`);
  }

  lines.push(`  Updated: ${results.updated.length}`);
  for (const handle of results.updated) {
    lines.push(`    ~ ${handle}`);
  }

  lines.push(`  Skipped: ${results.skipped.length}`);

  if (results.errors.length > 0) {
    lines.push(`  Errors: ${results.errors.length}`);
    for (const { handle, error } of results.errors) {
      lines.push(`    ! ${handle}: ${error}`);
    }
  }
  lines.push('');

  // Redirect operations
  lines.push('URL REDIRECTS (SEO Preservation):');
  lines.push(`  Created: ${results.redirectsCreated.length}`);
  for (const { path, target } of results.redirectsCreated) {
    lines.push(`    + ${path} -> ${target}`);
  }

  if (results.redirectErrors.length > 0) {
    lines.push(`  Errors: ${results.redirectErrors.length}`);
    for (const { path, error } of results.redirectErrors) {
      lines.push(`    ! ${path}: ${error}`);
    }
  }

  lines.push('');
  lines.push('='.repeat(70));

  return lines.join('\n');
}
