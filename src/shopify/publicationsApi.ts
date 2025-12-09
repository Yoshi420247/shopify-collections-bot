/**
 * Shopify Publications API
 * Handle publishing collections to the Online Store
 */

import { shopifyAdminRequest, checkUserErrors, type UserError } from './graphqlClient.js';
import type { ShopifyPublication } from '../types.js';

// Cache for Online Store publication ID
let cachedOnlineStorePublicationId: string | null = null;

// ===========================================
// GRAPHQL QUERIES
// ===========================================

const GET_PUBLICATIONS = `
  query GetPublications($first: Int!) {
    publications(first: $first) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const PUBLISH_TO_PUBLICATION = `
  mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable {
        ... on Collection {
          id
          handle
          title
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UNPUBLISH_FROM_PUBLICATION = `
  mutation PublishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
    publishableUnpublish(id: $id, input: $input) {
      publishable {
        ... on Collection {
          id
          handle
          title
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_COLLECTION_PUBLICATIONS = `
  query GetCollectionPublications($id: ID!) {
    collection(id: $id) {
      id
      handle
      publishedOnPublication(publicationId: $publicationId)
    }
  }
`;

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get all publications
 */
export async function getPublications(first: number = 25): Promise<ShopifyPublication[]> {
  interface Response {
    publications: {
      edges: Array<{
        node: ShopifyPublication;
      }>;
    };
  }

  const data = await shopifyAdminRequest<Response>(
    GET_PUBLICATIONS,
    { first },
    'GetPublications'
  );

  return data.publications.edges.map(edge => edge.node);
}

/**
 * Find the Online Store publication
 * This looks for publications with common Online Store names
 */
export async function findOnlineStorePublication(): Promise<ShopifyPublication | null> {
  const publications = await getPublications();

  // Common names for the Online Store publication
  const onlineStoreNames = [
    'Online Store',
    'online store',
    'Online store',
    'Web'
  ];

  const onlineStore = publications.find(pub =>
    onlineStoreNames.some(name =>
      pub.name.toLowerCase().includes(name.toLowerCase())
    )
  );

  return onlineStore || null;
}

/**
 * Get the Online Store publication ID
 * Uses env var if available, otherwise fetches dynamically
 */
export async function getOnlineStorePublicationId(): Promise<string> {
  // Check environment variable first
  const envPublicationId = process.env.SHOPIFY_ONLINE_STORE_PUBLICATION_ID;
  if (envPublicationId) {
    return envPublicationId;
  }

  // Check cache
  if (cachedOnlineStorePublicationId) {
    return cachedOnlineStorePublicationId;
  }

  // Fetch dynamically
  const onlineStore = await findOnlineStorePublication();
  if (!onlineStore) {
    throw new Error(
      'Could not find Online Store publication. ' +
      'Please set SHOPIFY_ONLINE_STORE_PUBLICATION_ID environment variable.'
    );
  }

  cachedOnlineStorePublicationId = onlineStore.id;
  return onlineStore.id;
}

/**
 * Publish a collection to the Online Store
 */
export async function publishCollectionToOnlineStore(collectionId: string): Promise<void> {
  interface Response {
    publishablePublish: {
      publishable: {
        id: string;
        handle: string;
        title: string;
      } | null;
      userErrors: UserError[];
    };
  }

  const publicationId = await getOnlineStorePublicationId();

  const data = await shopifyAdminRequest<Response>(
    PUBLISH_TO_PUBLICATION,
    {
      id: collectionId,
      input: [{ publicationId }]
    },
    'PublishablePublish'
  );

  checkUserErrors(data.publishablePublish, 'PublishablePublish');
}

/**
 * Unpublish a collection from the Online Store
 */
export async function unpublishCollectionFromOnlineStore(collectionId: string): Promise<void> {
  interface Response {
    publishableUnpublish: {
      publishable: {
        id: string;
        handle: string;
        title: string;
      } | null;
      userErrors: UserError[];
    };
  }

  const publicationId = await getOnlineStorePublicationId();

  const data = await shopifyAdminRequest<Response>(
    UNPUBLISH_FROM_PUBLICATION,
    {
      id: collectionId,
      input: [{ publicationId }]
    },
    'PublishableUnpublish'
  );

  checkUserErrors(data.publishableUnpublish, 'PublishableUnpublish');
}

/**
 * Publish multiple collections to the Online Store
 */
export async function publishCollectionsToOnlineStore(collectionIds: string[]): Promise<{
  success: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ id: string; error: string }>
  };

  for (const collectionId of collectionIds) {
    try {
      await publishCollectionToOnlineStore(collectionId);
      results.success.push(collectionId);
    } catch (error) {
      results.failed.push({
        id: collectionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

/**
 * Clear the cached publication ID
 */
export function clearPublicationCache(): void {
  cachedOnlineStorePublicationId = null;
}
