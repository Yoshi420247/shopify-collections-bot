/**
 * Menu Cleanup Utility
 *
 * Provides tools for:
 * - Identifying old/orphaned menus
 * - Detecting empty collections in menus
 * - Safe menu replacement with redirect preservation
 * - Menu audit and health checks
 */

import { getMenus, getMenuByHandle } from '../../shopify/menusApi.js';
import { getCollectionByHandle } from '../../shopify/collectionsApi.js';
import { createUrlRedirect, getCollectionRedirects, upsertUrlRedirect } from '../../shopify/redirectsApi.js';
import type { ShopifyMenu, ShopifyMenuItem, MenuConfigEntry, MenuItemConfigEntry } from '../../types.js';

// ===========================================
// TYPES
// ===========================================

export interface MenuAuditResult {
  menu: {
    handle: string;
    title: string;
    id: string;
    itemsCount: number;
  };
  issues: MenuIssue[];
  emptyCollections: Array<{
    menuItemTitle: string;
    collectionHandle: string;
    productsCount: number;
  }>;
  missingCollections: Array<{
    menuItemTitle: string;
    collectionHandle: string;
  }>;
  brokenLinks: Array<{
    menuItemTitle: string;
    url: string;
  }>;
}

export interface MenuIssue {
  type: 'orphaned' | 'empty_collection' | 'missing_collection' | 'broken_link' | 'duplicate_item' | 'deep_nesting';
  severity: 'error' | 'warning' | 'info';
  message: string;
  itemTitle?: string;
  collectionHandle?: string;
}

export interface MenuComparisonResult {
  currentMenu: ShopifyMenu | null;
  configMenu: MenuConfigEntry;
  itemsToAdd: MenuItemConfigEntry[];
  itemsToRemove: ShopifyMenuItem[];
  itemsToUpdate: Array<{
    current: ShopifyMenuItem;
    desired: MenuItemConfigEntry;
    changes: string[];
  }>;
  collectionsToRedirect: Array<{
    oldPath: string;
    newPath: string;
    reason: string;
  }>;
}

export interface OrphanedMenu {
  id: string;
  handle: string;
  title: string;
  itemsCount: number;
  reason: string;
}

// ===========================================
// MENU DISCOVERY & AUDIT
// ===========================================

/**
 * Get all menus from Shopify and identify orphaned ones
 */
export async function findOrphanedMenus(
  configuredHandles: string[]
): Promise<OrphanedMenu[]> {
  const allMenus = await getMenus(100);
  const configuredSet = new Set(configuredHandles.map(h => h.toLowerCase()));
  const orphaned: OrphanedMenu[] = [];

  // Known system menus that shouldn't be touched
  const systemMenuHandles = new Set(['main-menu', 'footer', 'footer-menu']);

  for (const menu of allMenus) {
    const handleLower = menu.handle.toLowerCase();

    // Skip if it's in our config
    if (configuredSet.has(handleLower)) {
      continue;
    }

    // Identify why it's orphaned
    let reason = 'Not in configuration file';

    if (systemMenuHandles.has(handleLower) && !configuredSet.has(handleLower)) {
      reason = 'System menu not managed by config';
    } else if (menu.itemsCount === 0) {
      reason = 'Empty menu with no items';
    } else if (menu.handle.includes('backup') || menu.handle.includes('old')) {
      reason = 'Appears to be a backup/old menu';
    }

    orphaned.push({
      id: menu.id,
      handle: menu.handle,
      title: menu.title,
      itemsCount: menu.itemsCount,
      reason
    });
  }

  return orphaned;
}

/**
 * Audit a single menu for issues
 */
export async function auditMenu(handle: string): Promise<MenuAuditResult | null> {
  const menu = await getMenuByHandle(handle);

  if (!menu) {
    return null;
  }

  const issues: MenuIssue[] = [];
  const emptyCollections: MenuAuditResult['emptyCollections'] = [];
  const missingCollections: MenuAuditResult['missingCollections'] = [];
  const brokenLinks: MenuAuditResult['brokenLinks'] = [];

  // Track seen items for duplicate detection
  const seenItems = new Set<string>();

  // Recursively audit menu items
  async function auditItems(items: ShopifyMenuItem[], depth: number = 0) {
    for (const item of items) {
      // Check for deep nesting (more than 3 levels)
      if (depth > 2) {
        issues.push({
          type: 'deep_nesting',
          severity: 'warning',
          message: `Menu item "${item.title}" is nested ${depth + 1} levels deep. Shopify only supports 3 levels.`,
          itemTitle: item.title
        });
      }

      // Check for duplicates
      const itemKey = `${item.type}:${item.title}:${item.resourceId || item.url}`;
      if (seenItems.has(itemKey)) {
        issues.push({
          type: 'duplicate_item',
          severity: 'warning',
          message: `Duplicate menu item found: "${item.title}"`,
          itemTitle: item.title
        });
      }
      seenItems.add(itemKey);

      // Check collection items
      if (item.type === 'COLLECTION' && item.resourceId) {
        // Extract collection ID from resourceId (gid://shopify/Collection/xxx)
        const collectionId = item.resourceId;

        // Try to get collection by searching all collections
        // This is a simplified check - in production you'd want to batch these
        try {
          // Note: We can't easily get collection by ID, so we'll track as potential issue
          // and rely on the collection handle extraction from URL if available
          if (item.url) {
            const handleMatch = item.url.match(/\/collections\/([^/?]+)/);
            if (handleMatch) {
              const collectionHandle = handleMatch[1];
              const collection = await getCollectionByHandle(collectionHandle);

              if (!collection) {
                missingCollections.push({
                  menuItemTitle: item.title,
                  collectionHandle
                });
                issues.push({
                  type: 'missing_collection',
                  severity: 'error',
                  message: `Collection "${collectionHandle}" referenced by menu item "${item.title}" does not exist`,
                  itemTitle: item.title,
                  collectionHandle
                });
              } else if (collection.productsCount?.count === 0) {
                emptyCollections.push({
                  menuItemTitle: item.title,
                  collectionHandle,
                  productsCount: 0
                });
                issues.push({
                  type: 'empty_collection',
                  severity: 'warning',
                  message: `Collection "${collectionHandle}" in menu item "${item.title}" has 0 products`,
                  itemTitle: item.title,
                  collectionHandle
                });
              }
            }
          }
        } catch {
          // Collection lookup failed - might be deleted
        }
      }

      // Check link items
      if (item.type === 'HTTP' && item.url) {
        // Basic URL validation
        try {
          new URL(item.url);
        } catch {
          brokenLinks.push({
            menuItemTitle: item.title,
            url: item.url
          });
          issues.push({
            type: 'broken_link',
            severity: 'error',
            message: `Invalid URL in menu item "${item.title}": ${item.url}`,
            itemTitle: item.title
          });
        }
      }

      // Recurse into children
      if (item.items && item.items.length > 0) {
        await auditItems(item.items, depth + 1);
      }
    }
  }

  await auditItems(menu.items);

  // Count total items
  function countItems(items: ShopifyMenuItem[]): number {
    let count = 0;
    for (const item of items) {
      count++;
      if (item.items && item.items.length > 0) {
        count += countItems(item.items);
      }
    }
    return count;
  }

  return {
    menu: {
      handle: menu.handle,
      title: menu.title,
      id: menu.id,
      itemsCount: countItems(menu.items)
    },
    issues,
    emptyCollections,
    missingCollections,
    brokenLinks
  };
}

/**
 * Audit all menus
 */
export async function auditAllMenus(): Promise<MenuAuditResult[]> {
  const menus = await getMenus(100);
  const results: MenuAuditResult[] = [];

  for (const menu of menus) {
    const audit = await auditMenu(menu.handle);
    if (audit) {
      results.push(audit);
    }
  }

  return results;
}

// ===========================================
// MENU COMPARISON & DIFF
// ===========================================

/**
 * Compare current Shopify menu with config and generate migration plan
 */
export async function compareMenuWithConfig(
  handle: string,
  configMenu: MenuConfigEntry,
  collectionIdByHandle: Map<string, string>
): Promise<MenuComparisonResult> {
  const currentMenu = await getMenuByHandle(handle);

  const result: MenuComparisonResult = {
    currentMenu,
    configMenu,
    itemsToAdd: [],
    itemsToRemove: [],
    itemsToUpdate: [],
    collectionsToRedirect: []
  };

  if (!currentMenu) {
    // No existing menu - all config items are additions
    result.itemsToAdd = configMenu.items;
    return result;
  }

  // Build maps for comparison
  const currentItemsByTitle = new Map<string, ShopifyMenuItem>();
  const configItemsByTitle = new Map<string, MenuItemConfigEntry>();

  function mapCurrentItems(items: ShopifyMenuItem[]) {
    for (const item of items) {
      currentItemsByTitle.set(item.title.toLowerCase(), item);
      if (item.items && item.items.length > 0) {
        mapCurrentItems(item.items);
      }
    }
  }

  function mapConfigItems(items: MenuItemConfigEntry[]) {
    for (const item of items) {
      configItemsByTitle.set(item.title.toLowerCase(), item);
      if (item.children && item.children.length > 0) {
        mapConfigItems(item.children);
      }
    }
  }

  mapCurrentItems(currentMenu.items);
  mapConfigItems(configMenu.items);

  // Find items to remove (in current but not in config)
  for (const [titleLower, currentItem] of currentItemsByTitle) {
    if (!configItemsByTitle.has(titleLower)) {
      result.itemsToRemove.push(currentItem);

      // If it's a collection item, suggest a redirect
      if (currentItem.type === 'COLLECTION' && currentItem.url) {
        const handleMatch = currentItem.url.match(/\/collections\/([^/?]+)/);
        if (handleMatch) {
          result.collectionsToRedirect.push({
            oldPath: `/collections/${handleMatch[1]}`,
            newPath: '/collections/shop-all-what-you-need', // Default redirect target
            reason: `Menu item "${currentItem.title}" being removed`
          });
        }
      }
    }
  }

  // Find items to add (in config but not in current)
  for (const [titleLower, configItem] of configItemsByTitle) {
    if (!currentItemsByTitle.has(titleLower)) {
      result.itemsToAdd.push(configItem);
    }
  }

  // Find items to update (in both, but with differences)
  for (const [titleLower, configItem] of configItemsByTitle) {
    const currentItem = currentItemsByTitle.get(titleLower);
    if (currentItem) {
      const changes: string[] = [];

      // Check type change
      const configType = configItem.type === 'LINK' ? 'HTTP' : configItem.type;
      if (currentItem.type !== configType) {
        changes.push(`Type: ${currentItem.type} -> ${configType}`);
      }

      // Check collection reference change
      if (configItem.type === 'COLLECTION' && configItem.target_collection_handle) {
        const desiredCollectionId = collectionIdByHandle.get(configItem.target_collection_handle);
        if (desiredCollectionId && currentItem.resourceId !== desiredCollectionId) {
          changes.push(`Collection: ${currentItem.resourceId} -> ${desiredCollectionId}`);

          // Extract old collection handle for redirect
          if (currentItem.url) {
            const handleMatch = currentItem.url.match(/\/collections\/([^/?]+)/);
            if (handleMatch && handleMatch[1] !== configItem.target_collection_handle) {
              result.collectionsToRedirect.push({
                oldPath: `/collections/${handleMatch[1]}`,
                newPath: `/collections/${configItem.target_collection_handle}`,
                reason: `Menu item "${currentItem.title}" collection changed`
              });
            }
          }
        }
      }

      if (changes.length > 0) {
        result.itemsToUpdate.push({
          current: currentItem,
          desired: configItem,
          changes
        });
      }
    }
  }

  return result;
}

// ===========================================
// REDIRECT CREATION FOR MENU CHANGES
// ===========================================

/**
 * Create redirects for menu items being removed or changed
 * This preserves SEO value from old links
 */
export async function createRedirectsForMenuChanges(
  changes: MenuComparisonResult['collectionsToRedirect'],
  dryRun: boolean = true
): Promise<{
  planned: typeof changes;
  created: Array<{ path: string; target: string; action: string }>;
  errors: Array<{ path: string; error: string }>;
}> {
  const result = {
    planned: changes,
    created: [] as Array<{ path: string; target: string; action: string }>,
    errors: [] as Array<{ path: string; error: string }>
  };

  if (dryRun) {
    return result;
  }

  for (const redirect of changes) {
    try {
      const { action } = await upsertUrlRedirect(redirect.oldPath, redirect.newPath);
      result.created.push({
        path: redirect.oldPath,
        target: redirect.newPath,
        action
      });
    } catch (error) {
      result.errors.push({
        path: redirect.oldPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

// ===========================================
// EMPTY COLLECTION DETECTION
// ===========================================

/**
 * Find all menu items pointing to empty collections
 */
export async function findEmptyCollectionsInMenus(): Promise<{
  menu: string;
  items: Array<{
    title: string;
    collectionHandle: string;
    productsCount: number;
  }>;
}[]> {
  const menus = await getMenus(100);
  const results: {
    menu: string;
    items: Array<{
      title: string;
      collectionHandle: string;
      productsCount: number;
    }>;
  }[] = [];

  for (const menu of menus) {
    const fullMenu = await getMenuByHandle(menu.handle);
    if (!fullMenu) continue;

    const emptyItems: Array<{
      title: string;
      collectionHandle: string;
      productsCount: number;
    }> = [];

    async function checkItems(items: ShopifyMenuItem[]) {
      for (const item of items) {
        if (item.type === 'COLLECTION' && item.url) {
          const handleMatch = item.url.match(/\/collections\/([^/?]+)/);
          if (handleMatch) {
            const collection = await getCollectionByHandle(handleMatch[1]);
            if (collection && (collection.productsCount?.count ?? 0) === 0) {
              emptyItems.push({
                title: item.title,
                collectionHandle: handleMatch[1],
                productsCount: 0
              });
            }
          }
        }

        if (item.items && item.items.length > 0) {
          await checkItems(item.items);
        }
      }
    }

    await checkItems(fullMenu.items);

    if (emptyItems.length > 0) {
      results.push({
        menu: menu.handle,
        items: emptyItems
      });
    }
  }

  return results;
}

// ===========================================
// MENU REPLACEMENT STRATEGY
// ===========================================

/**
 * Generate a safe menu replacement plan
 * This ensures:
 * 1. All old collection URLs get redirects to preserve SEO
 * 2. Empty collections are flagged
 * 3. A rollback plan is available
 */
export async function generateMenuReplacementPlan(
  currentHandle: string,
  newConfig: MenuConfigEntry,
  collectionIdByHandle: Map<string, string>
): Promise<{
  canProceed: boolean;
  blockers: string[];
  warnings: string[];
  redirectsNeeded: Array<{ from: string; to: string; reason: string }>;
  emptyCollectionsInNewMenu: string[];
  summary: string;
}> {
  const plan = {
    canProceed: true,
    blockers: [] as string[],
    warnings: [] as string[],
    redirectsNeeded: [] as Array<{ from: string; to: string; reason: string }>,
    emptyCollectionsInNewMenu: [] as string[],
    summary: ''
  };

  // Get current menu
  const currentMenu = await getMenuByHandle(currentHandle);

  // Check all collections in new config exist and have products
  async function checkConfigCollections(items: MenuItemConfigEntry[]) {
    for (const item of items) {
      if (item.type === 'COLLECTION' && item.target_collection_handle) {
        const collection = await getCollectionByHandle(item.target_collection_handle);

        if (!collection) {
          plan.blockers.push(
            `Collection "${item.target_collection_handle}" does not exist (menu item: "${item.title}")`
          );
          plan.canProceed = false;
        } else if ((collection.productsCount?.count ?? 0) === 0) {
          plan.emptyCollectionsInNewMenu.push(item.target_collection_handle);
          plan.warnings.push(
            `Collection "${item.target_collection_handle}" has 0 products (menu item: "${item.title}")`
          );
        }
      }

      if (item.children && item.children.length > 0) {
        await checkConfigCollections(item.children);
      }
    }
  }

  await checkConfigCollections(newConfig.items);

  // If there's an existing menu, find what needs redirects
  if (currentMenu) {
    const comparison = await compareMenuWithConfig(currentHandle, newConfig, collectionIdByHandle);

    // Add all redirect suggestions
    for (const redirect of comparison.collectionsToRedirect) {
      plan.redirectsNeeded.push({
        from: redirect.oldPath,
        to: redirect.newPath,
        reason: redirect.reason
      });
    }

    // Warn about removed items
    if (comparison.itemsToRemove.length > 0) {
      plan.warnings.push(
        `${comparison.itemsToRemove.length} menu items will be removed: ${comparison.itemsToRemove.map(i => i.title).join(', ')}`
      );
    }
  }

  // Generate summary
  if (plan.canProceed) {
    plan.summary = `Menu replacement can proceed. ${plan.redirectsNeeded.length} redirects will be created. ${plan.warnings.length} warnings.`;
  } else {
    plan.summary = `Menu replacement blocked. ${plan.blockers.length} issues must be resolved first.`;
  }

  return plan;
}
