/**
 * Shopify SEO API
 * Manages SEO-related metafields for collections and products
 *
 * Used to set:
 * - Custom meta titles and descriptions
 * - Rich descriptions for LLM/AI search optimization
 * - Structured data hints
 */

import { shopifyAdminRequest, checkUserErrors, type UserError } from './graphqlClient.js';

// ===========================================
// TYPES
// ===========================================

export interface SeoMetafields {
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  llmDescription?: string;  // Rich description for AI search engines
}

export interface CollectionSeoData {
  id: string;
  handle: string;
  title: string;
  seo: {
    title: string | null;
    description: string | null;
  };
  descriptionHtml: string | null;
}

// ===========================================
// GRAPHQL QUERIES & MUTATIONS
// ===========================================

const GET_COLLECTION_SEO = `
  query GetCollectionSeo($handle: String!) {
    collectionByHandle(handle: $handle) {
      id
      handle
      title
      seo {
        title
        description
      }
      descriptionHtml
    }
  }
`;

const UPDATE_COLLECTION_SEO = `
  mutation CollectionUpdate($input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection {
        id
        handle
        title
        seo {
          title
          description
        }
        descriptionHtml
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_COLLECTIONS_WITH_SEO = `
  query GetCollectionsWithSeo($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node {
          id
          handle
          title
          seo {
            title
            description
          }
          descriptionHtml
          productsCount {
            count
          }
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

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get SEO data for a collection
 */
export async function getCollectionSeo(handle: string): Promise<CollectionSeoData | null> {
  interface Response {
    collectionByHandle: CollectionSeoData | null;
  }

  const data = await shopifyAdminRequest<Response>(
    GET_COLLECTION_SEO,
    { handle },
    'GetCollectionSeo'
  );

  return data.collectionByHandle;
}

/**
 * Update SEO fields for a collection
 *
 * @param id - The collection ID (gid://shopify/Collection/xxx)
 * @param seoTitle - Custom title for search engines (meta title)
 * @param seoDescription - Custom description for search engines (meta description)
 * @param descriptionHtml - Rich HTML description (visible on page, also used by LLMs)
 */
export async function updateCollectionSeo(
  id: string,
  seoTitle?: string,
  seoDescription?: string,
  descriptionHtml?: string
): Promise<CollectionSeoData> {
  interface Response {
    collectionUpdate: {
      collection: CollectionSeoData | null;
      userErrors: UserError[];
    };
  }

  const input: Record<string, unknown> = { id };

  if (seoTitle !== undefined || seoDescription !== undefined) {
    input.seo = {};
    if (seoTitle !== undefined) {
      (input.seo as Record<string, unknown>).title = seoTitle;
    }
    if (seoDescription !== undefined) {
      (input.seo as Record<string, unknown>).description = seoDescription;
    }
  }

  if (descriptionHtml !== undefined) {
    input.descriptionHtml = descriptionHtml;
  }

  const data = await shopifyAdminRequest<Response>(
    UPDATE_COLLECTION_SEO,
    { input },
    'CollectionUpdate'
  );

  checkUserErrors(data.collectionUpdate, 'CollectionUpdate');

  if (!data.collectionUpdate.collection) {
    throw new Error('Collection SEO update returned no collection');
  }

  return data.collectionUpdate.collection;
}

/**
 * Get all collections with their SEO data
 */
export async function getAllCollectionsSeo(): Promise<Array<CollectionSeoData & { productsCount: number }>> {
  interface Response {
    collections: {
      edges: Array<{
        node: CollectionSeoData & { productsCount: { count: number } };
        cursor: string;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  }

  const allCollections: Array<CollectionSeoData & { productsCount: number }> = [];
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const data: Response = await shopifyAdminRequest<Response>(
      GET_COLLECTIONS_WITH_SEO,
      { first: 50, after },
      'GetCollectionsWithSeo'
    );

    type EdgeType = { node: CollectionSeoData & { productsCount: { count: number } }; cursor: string };
    const collections = data.collections.edges.map((edge: EdgeType) => ({
      ...edge.node,
      productsCount: edge.node.productsCount?.count ?? 0
    }));

    allCollections.push(...collections);
    hasNextPage = data.collections.pageInfo.hasNextPage;
    after = data.collections.pageInfo.endCursor;
  }

  return allCollections;
}

/**
 * Generate LLM-optimized description for a collection
 * Creates rich, semantic descriptions that AI search engines can understand
 */
export function generateLLMDescription(
  title: string,
  category: string,
  productTypes: string[],
  brandContext?: string
): string {
  const typeList = productTypes.length > 0
    ? productTypes.join(', ')
    : 'smoking accessories and glassware';

  let description = `${title} - Browse our curated selection of ${typeList}. `;

  if (category === 'devices') {
    description += `High-quality smoking devices designed for flower and concentrate enthusiasts. `;
  } else if (category === 'accessories') {
    description += `Essential accessories to enhance your smoking experience. `;
  } else if (category === 'brands') {
    description += `Authentic products from trusted brands in the smoking industry. `;
    if (brandContext) {
      description += `${brandContext} `;
    }
  } else if (category === 'themes') {
    description += `Specially curated collection for discerning smokers. `;
  }

  description += `Shop now at What You Need for fast shipping and quality guarantee.`;

  return description;
}

/**
 * Generate SEO-optimized meta title
 * Follows best practices: primary keyword, brand, under 60 chars
 */
export function generateSeoTitle(
  collectionTitle: string,
  storeName: string = 'What You Need'
): string {
  // Base format: "Collection Title | Store Name"
  const fullTitle = `${collectionTitle} | ${storeName}`;

  // If under 60 chars, use as-is
  if (fullTitle.length <= 60) {
    return fullTitle;
  }

  // Truncate collection title to fit
  const maxCollectionLength = 60 - ` | ${storeName}`.length;
  const truncatedTitle = collectionTitle.substring(0, maxCollectionLength - 3) + '...';
  return `${truncatedTitle} | ${storeName}`;
}

/**
 * Generate SEO-optimized meta description
 * Follows best practices: action-oriented, under 160 chars, includes keywords
 */
export function generateSeoDescription(
  collectionTitle: string,
  productTypes: string[],
  category: string
): string {
  const typePhrase = productTypes.length > 0
    ? productTypes.slice(0, 3).join(', ')
    : 'premium smoking accessories';

  let description = '';

  if (category === 'devices') {
    description = `Shop ${collectionTitle} - Premium ${typePhrase} with fast shipping. Quality glass and devices at great prices. Browse our selection today!`;
  } else if (category === 'accessories') {
    description = `Find the best ${collectionTitle} - ${typePhrase} and more. Essential smoking accessories with fast shipping. Shop What You Need now!`;
  } else if (category === 'brands') {
    description = `Authentic ${collectionTitle} products - ${typePhrase}. Official brand products with quality guarantee. Shop the full collection today!`;
  } else if (category === 'themes') {
    description = `Discover ${collectionTitle} - Curated ${typePhrase} for discerning smokers. Premium selection with fast shipping. Shop now!`;
  } else {
    description = `Shop ${collectionTitle} at What You Need - ${typePhrase}. Quality products, fast shipping, great prices. Browse our selection!`;
  }

  // Ensure under 160 chars
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }

  return description;
}

/**
 * Audit SEO data across all collections
 * Returns collections missing SEO titles, descriptions, or with issues
 */
export async function auditCollectionsSeo(): Promise<{
  total: number;
  missingSeoTitle: Array<{ handle: string; title: string }>;
  missingSeoDescription: Array<{ handle: string; title: string }>;
  missingDescription: Array<{ handle: string; title: string }>;
  emptyCollections: Array<{ handle: string; title: string; productsCount: number }>;
  seoTitleTooLong: Array<{ handle: string; title: string; seoTitleLength: number }>;
  seoDescriptionTooLong: Array<{ handle: string; title: string; seoDescLength: number }>;
}> {
  const collections = await getAllCollectionsSeo();

  const audit = {
    total: collections.length,
    missingSeoTitle: [] as Array<{ handle: string; title: string }>,
    missingSeoDescription: [] as Array<{ handle: string; title: string }>,
    missingDescription: [] as Array<{ handle: string; title: string }>,
    emptyCollections: [] as Array<{ handle: string; title: string; productsCount: number }>,
    seoTitleTooLong: [] as Array<{ handle: string; title: string; seoTitleLength: number }>,
    seoDescriptionTooLong: [] as Array<{ handle: string; title: string; seoDescLength: number }>
  };

  for (const collection of collections) {
    // Check for missing SEO title
    if (!collection.seo?.title) {
      audit.missingSeoTitle.push({ handle: collection.handle, title: collection.title });
    } else if (collection.seo.title.length > 60) {
      audit.seoTitleTooLong.push({
        handle: collection.handle,
        title: collection.title,
        seoTitleLength: collection.seo.title.length
      });
    }

    // Check for missing SEO description
    if (!collection.seo?.description) {
      audit.missingSeoDescription.push({ handle: collection.handle, title: collection.title });
    } else if (collection.seo.description.length > 160) {
      audit.seoDescriptionTooLong.push({
        handle: collection.handle,
        title: collection.title,
        seoDescLength: collection.seo.description.length
      });
    }

    // Check for missing page description
    if (!collection.descriptionHtml || collection.descriptionHtml.trim() === '') {
      audit.missingDescription.push({ handle: collection.handle, title: collection.title });
    }

    // Check for empty collections
    if (collection.productsCount === 0) {
      audit.emptyCollections.push({
        handle: collection.handle,
        title: collection.title,
        productsCount: 0
      });
    }
  }

  return audit;
}
