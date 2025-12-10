/**
 * Shopify Menus API
 * CRUD operations for Shopify navigation menus via Admin GraphQL API
 */

import { shopifyAdminRequest, checkUserErrors, type UserError } from './graphqlClient.js';
import type { ShopifyMenu, ShopifyMenuItem, MenuItemConfigEntry } from '../types.js';

// ===========================================
// GRAPHQL QUERIES
// ===========================================

const GET_MENU_BY_ID = `
  query GetMenuById($id: ID!) {
    menu(id: $id) {
      id
      handle
      title
      items {
        id
        title
        type
        resourceId
        url
        items {
          id
          title
          type
          resourceId
          url
          items {
            id
            title
            type
            resourceId
            url
          }
        }
      }
    }
  }
`;

const GET_MENUS = `
  query GetMenus($first: Int!) {
    menus(first: $first) {
      edges {
        node {
          id
          handle
          title
        }
      }
    }
  }
`;

const CREATE_MENU = `
  mutation MenuCreate($handle: String!, $title: String!, $items: [MenuItemCreateInput!]!) {
    menuCreate(handle: $handle, title: $title, items: $items) {
      menu {
        id
        handle
        title
        items {
          id
          title
          type
          resourceId
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_MENU = `
  mutation MenuUpdate($id: ID!, $title: String, $items: [MenuItemCreateInput!]) {
    menuUpdate(id: $id, title: $title, items: $items) {
      menu {
        id
        handle
        title
        items {
          id
          title
          type
          resourceId
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
 * Map internal menu item type to Shopify MenuItemType enum
 */
function mapMenuItemType(type: string): string {
  const mapping: Record<string, string> = {
    'COLLECTION': 'COLLECTION',
    'PRODUCT': 'PRODUCT',
    'PAGE': 'PAGE',
    'BLOG': 'BLOG',
    'LINK': 'HTTP',
    'CATALOG': 'CATALOG'
  };
  return mapping[type] || type;
}

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get a menu by its handle
 * Note: Shopify Admin API doesn't support direct handle lookup,
 * so we fetch all menus and filter by handle, then get full details
 */
export async function getMenuByHandle(handle: string): Promise<ShopifyMenu | null> {
  // First, get all menus to find the ID
  const menus = await getMenus(250);
  const menuSummary = menus.find(m => m.handle === handle);

  if (!menuSummary) {
    return null;
  }

  // Now get the full menu with items by ID
  interface Response {
    menu: ShopifyMenu | null;
  }

  const data = await shopifyAdminRequest<Response>(
    GET_MENU_BY_ID,
    { id: menuSummary.id },
    'GetMenuById'
  );

  return data.menu;
}

/**
 * Get all menus
 */
export async function getMenus(first: number = 50): Promise<Array<{ id: string; handle: string; title: string }>> {
  interface Response {
    menus: {
      edges: Array<{
        node: {
          id: string;
          handle: string;
          title: string;
        };
      }>;
    };
  }

  const data = await shopifyAdminRequest<Response>(
    GET_MENUS,
    { first },
    'GetMenus'
  );

  return data.menus.edges.map(edge => edge.node);
}

/**
 * Build menu items input for GraphQL mutation
 */
export function buildMenuItemsInput(
  items: MenuItemConfigEntry[],
  collectionIdByHandle: Map<string, string>
): Array<Record<string, unknown>> {
  return items.map(item => {
    const menuItem: Record<string, unknown> = {
      title: item.title,
      type: mapMenuItemType(item.type)
    };

    // Add resourceId for COLLECTION type
    if (item.type === 'COLLECTION' && item.target_collection_handle) {
      const collectionId = collectionIdByHandle.get(item.target_collection_handle);
      if (collectionId) {
        menuItem.resourceId = collectionId;
      } else {
        console.warn(`Warning: No collection ID found for handle "${item.target_collection_handle}"`);
      }
    }

    // Add URL for LINK type
    if (item.type === 'LINK' && item.url) {
      menuItem.url = item.url;
    }

    // Recursively build children
    if (item.children && item.children.length > 0) {
      menuItem.items = buildMenuItemsInput(item.children, collectionIdByHandle);
    }

    return menuItem;
  });
}

/**
 * Create a new menu
 */
export async function createMenu(
  handle: string,
  title: string,
  items: MenuItemConfigEntry[],
  collectionIdByHandle: Map<string, string>
): Promise<ShopifyMenu> {
  interface Response {
    menuCreate: {
      menu: ShopifyMenu | null;
      userErrors: UserError[];
    };
  }

  const menuItems = buildMenuItemsInput(items, collectionIdByHandle);

  const data = await shopifyAdminRequest<Response>(
    CREATE_MENU,
    { handle, title, items: menuItems },
    'MenuCreate'
  );

  checkUserErrors(data.menuCreate, 'MenuCreate');

  if (!data.menuCreate.menu) {
    throw new Error('Menu creation returned no menu');
  }

  return data.menuCreate.menu;
}

/**
 * Update an existing menu
 */
export async function updateMenu(
  id: string,
  title: string,
  items: MenuItemConfigEntry[],
  collectionIdByHandle: Map<string, string>
): Promise<ShopifyMenu> {
  interface Response {
    menuUpdate: {
      menu: ShopifyMenu | null;
      userErrors: UserError[];
    };
  }

  const menuItems = buildMenuItemsInput(items, collectionIdByHandle);

  const data = await shopifyAdminRequest<Response>(
    UPDATE_MENU,
    { id, title, items: menuItems },
    'MenuUpdate'
  );

  checkUserErrors(data.menuUpdate, 'MenuUpdate');

  if (!data.menuUpdate.menu) {
    throw new Error('Menu update returned no menu');
  }

  return data.menuUpdate.menu;
}

/**
 * Count total items in a Shopify menu (recursive)
 */
export function countShopifyMenuItems(items: ShopifyMenuItem[]): number {
  let count = 0;

  function traverse(items: ShopifyMenuItem[]) {
    items.forEach(item => {
      count++;
      if (item.items && item.items.length > 0) {
        traverse(item.items);
      }
    });
  }

  traverse(items);
  return count;
}

/**
 * Print existing menu structure for comparison
 */
export function printExistingMenuStructure(menu: ShopifyMenu): string {
  const lines: string[] = [];
  lines.push(`Menu: ${menu.title} (${menu.handle})`);

  function printItems(items: ShopifyMenuItem[], depth: number) {
    const prefix = '  '.repeat(depth);
    items.forEach(item => {
      const resource = item.resourceId ? ` [${item.resourceId}]` : '';
      lines.push(`${prefix}- ${item.title} [${item.type}]${resource}`);
      if (item.items && item.items.length > 0) {
        printItems(item.items, depth + 1);
      }
    });
  }

  printItems(menu.items, 1);
  return lines.join('\n');
}
