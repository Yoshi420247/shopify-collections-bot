/**
 * Shopify URL Redirects API
 * CRUD operations for URL redirects via Admin GraphQL API
 *
 * Used to preserve SEO link equity when:
 * - Changing collection handles
 * - Replacing menus
 * - Removing old menu items
 */

import { shopifyAdminRequest, shopifyAdminRequestWithRetry, checkUserErrors, type UserError } from './graphqlClient.js';

// ===========================================
// TYPES
// ===========================================

export interface UrlRedirect {
  id: string;
  path: string;
  target: string;
}

export interface UrlRedirectCreateResult {
  redirect: UrlRedirect | null;
  userErrors: UserError[];
}

// ===========================================
// GRAPHQL QUERIES & MUTATIONS
// ===========================================

const GET_URL_REDIRECTS = `
  query GetUrlRedirects($first: Int!, $after: String, $query: String) {
    urlRedirects(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          path
          target
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_URL_REDIRECT_BY_PATH = `
  query GetUrlRedirectByPath($path: String!) {
    urlRedirectByPath(path: $path) {
      id
      path
      target
    }
  }
`;

const CREATE_URL_REDIRECT = `
  mutation UrlRedirectCreate($urlRedirect: UrlRedirectInput!) {
    urlRedirectCreate(urlRedirect: $urlRedirect) {
      urlRedirect {
        id
        path
        target
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_URL_REDIRECT = `
  mutation UrlRedirectUpdate($id: ID!, $urlRedirect: UrlRedirectInput!) {
    urlRedirectUpdate(id: $id, urlRedirect: $urlRedirect) {
      urlRedirect {
        id
        path
        target
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_URL_REDIRECT = `
  mutation UrlRedirectDelete($id: ID!) {
    urlRedirectDelete(id: $id) {
      deletedUrlRedirectId
      userErrors {
        field
        message
      }
    }
  }
`;

const BULK_DELETE_URL_REDIRECTS = `
  mutation UrlRedirectBulkDeleteByIds($ids: [ID!]!) {
    urlRedirectBulkDeleteByIds(ids: $ids) {
      job {
        id
        done
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get all URL redirects with optional filtering
 */
export async function getUrlRedirects(
  first: number = 50,
  query?: string
): Promise<UrlRedirect[]> {
  interface Response {
    urlRedirects: {
      edges: Array<{
        node: UrlRedirect;
        cursor: string;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  }

  const allRedirects: UrlRedirect[] = [];
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const data: Response = await shopifyAdminRequestWithRetry<Response>(
      GET_URL_REDIRECTS,
      { first, after, query },
      'GetUrlRedirects'
    );

    allRedirects.push(...data.urlRedirects.edges.map((edge: { node: UrlRedirect; cursor: string }) => edge.node));
    hasNextPage = data.urlRedirects.pageInfo.hasNextPage;
    after = data.urlRedirects.pageInfo.endCursor;
  }

  return allRedirects;
}

/**
 * Get a URL redirect by its source path
 */
export async function getUrlRedirectByPath(path: string): Promise<UrlRedirect | null> {
  interface Response {
    urlRedirectByPath: UrlRedirect | null;
  }

  const data = await shopifyAdminRequest<Response>(
    GET_URL_REDIRECT_BY_PATH,
    { path },
    'GetUrlRedirectByPath'
  );

  return data.urlRedirectByPath;
}

/**
 * Create a new URL redirect (301 permanent redirect)
 *
 * @param path - The source path to redirect FROM (e.g., "/collections/old-handle")
 * @param target - The destination path/URL to redirect TO (e.g., "/collections/new-handle")
 */
export async function createUrlRedirect(
  path: string,
  target: string
): Promise<UrlRedirect> {
  interface Response {
    urlRedirectCreate: {
      urlRedirect: UrlRedirect | null;
      userErrors: UserError[];
    };
  }

  const data = await shopifyAdminRequest<Response>(
    CREATE_URL_REDIRECT,
    { urlRedirect: { path, target } },
    'UrlRedirectCreate'
  );

  checkUserErrors(data.urlRedirectCreate, 'UrlRedirectCreate');

  if (!data.urlRedirectCreate.urlRedirect) {
    throw new Error('URL redirect creation returned no redirect');
  }

  return data.urlRedirectCreate.urlRedirect;
}

/**
 * Update an existing URL redirect
 */
export async function updateUrlRedirect(
  id: string,
  path: string,
  target: string
): Promise<UrlRedirect> {
  interface Response {
    urlRedirectUpdate: {
      urlRedirect: UrlRedirect | null;
      userErrors: UserError[];
    };
  }

  const data = await shopifyAdminRequest<Response>(
    UPDATE_URL_REDIRECT,
    { id, urlRedirect: { path, target } },
    'UrlRedirectUpdate'
  );

  checkUserErrors(data.urlRedirectUpdate, 'UrlRedirectUpdate');

  if (!data.urlRedirectUpdate.urlRedirect) {
    throw new Error('URL redirect update returned no redirect');
  }

  return data.urlRedirectUpdate.urlRedirect;
}

/**
 * Delete a URL redirect
 */
export async function deleteUrlRedirect(id: string): Promise<string> {
  interface Response {
    urlRedirectDelete: {
      deletedUrlRedirectId: string | null;
      userErrors: UserError[];
    };
  }

  const data = await shopifyAdminRequest<Response>(
    DELETE_URL_REDIRECT,
    { id },
    'UrlRedirectDelete'
  );

  checkUserErrors(data.urlRedirectDelete, 'UrlRedirectDelete');

  if (!data.urlRedirectDelete.deletedUrlRedirectId) {
    throw new Error('URL redirect deletion returned no ID');
  }

  return data.urlRedirectDelete.deletedUrlRedirectId;
}

/**
 * Create or update a URL redirect (upsert behavior)
 * If a redirect for the path already exists, update it; otherwise create new
 */
export async function upsertUrlRedirect(
  path: string,
  target: string
): Promise<{ redirect: UrlRedirect; action: 'created' | 'updated' | 'unchanged' }> {
  // Check if redirect already exists
  const existing = await getUrlRedirectByPath(path);

  if (existing) {
    // If target is the same, no change needed
    if (existing.target === target) {
      return { redirect: existing, action: 'unchanged' };
    }
    // Update existing redirect
    const updated = await updateUrlRedirect(existing.id, path, target);
    return { redirect: updated, action: 'updated' };
  }

  // Create new redirect
  const created = await createUrlRedirect(path, target);
  return { redirect: created, action: 'created' };
}

/**
 * Create redirects for collection handle changes
 * Creates /collections/old-handle -> /collections/new-handle redirect
 */
export async function createCollectionRedirect(
  oldHandle: string,
  newHandle: string
): Promise<{ redirect: UrlRedirect; action: 'created' | 'updated' | 'unchanged' }> {
  const path = `/collections/${oldHandle}`;
  const target = `/collections/${newHandle}`;
  return upsertUrlRedirect(path, target);
}

/**
 * Batch create multiple URL redirects
 */
export async function createUrlRedirectsBatch(
  redirects: Array<{ path: string; target: string }>
): Promise<Array<{ path: string; target: string; result: 'created' | 'updated' | 'unchanged' | 'error'; error?: string }>> {
  const results: Array<{ path: string; target: string; result: 'created' | 'updated' | 'unchanged' | 'error'; error?: string }> = [];

  for (const redirect of redirects) {
    try {
      const { action } = await upsertUrlRedirect(redirect.path, redirect.target);
      results.push({ path: redirect.path, target: redirect.target, result: action });
    } catch (error) {
      results.push({
        path: redirect.path,
        target: redirect.target,
        result: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

/**
 * Get all redirects pointing to a specific target
 */
export async function getRedirectsToTarget(target: string): Promise<UrlRedirect[]> {
  const allRedirects = await getUrlRedirects(250);
  return allRedirects.filter(r => r.target === target);
}

/**
 * Get all collection-related redirects
 */
export async function getCollectionRedirects(): Promise<UrlRedirect[]> {
  // Query for redirects with /collections/ in the path
  return getUrlRedirects(250, 'path:/collections/*');
}

/**
 * Consolidate redirect chains (A -> B and B -> C becomes A -> C)
 * This is important for SEO to avoid redirect chains
 */
export async function consolidateRedirectChains(): Promise<{
  consolidated: number;
  chains: Array<{ original: string; intermediate: string; final: string }>;
}> {
  const allRedirects = await getUrlRedirects(250);
  const redirectMap = new Map<string, UrlRedirect>(
    allRedirects.map(r => [r.path, r])
  );

  const chains: Array<{ original: string; intermediate: string; final: string }> = [];
  let consolidated = 0;

  for (const redirect of allRedirects) {
    // Check if target is also a source path (redirect chain)
    const nextRedirect = redirectMap.get(redirect.target);
    if (nextRedirect) {
      // Found a chain: redirect.path -> redirect.target -> nextRedirect.target
      chains.push({
        original: redirect.path,
        intermediate: redirect.target,
        final: nextRedirect.target
      });

      // Update the first redirect to point directly to final destination
      await updateUrlRedirect(redirect.id, redirect.path, nextRedirect.target);
      consolidated++;
    }
  }

  return { consolidated, chains };
}
