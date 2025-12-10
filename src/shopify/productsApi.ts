/**
 * Shopify Products API
 * Read operations for Shopify products via Admin GraphQL API
 */

import { shopifyAdminRequest } from './graphqlClient.js';

// ===========================================
// GRAPHQL QUERIES
// ===========================================

const GET_PRODUCTS = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          handle
          description
          vendor
          productType
          tags
          status
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_PRODUCT_BY_HANDLE = `
  query GetProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      handle
      description
      vendor
      productType
      tags
      status
    }
  }
`;

// ===========================================
// TYPES
// ===========================================

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

// ===========================================
// API FUNCTIONS
// ===========================================

interface ProductsResponse {
  products: {
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        title: string;
        handle: string;
        description: string;
        vendor: string;
        productType: string;
        tags: string[];
        status: string;
        createdAt?: string;
        updatedAt?: string;
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

interface ProductByHandleResponse {
  productByHandle: {
    id: string;
    title: string;
    handle: string;
    description: string;
    vendor: string;
    productType: string;
    tags: string[];
    status: string;
  } | null;
}

/**
 * Get products with pagination
 */
export async function getProducts(limit: number = 50): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage && products.length < limit) {
    const batchSize = Math.min(50, limit - products.length);

    const response = await shopifyAdminRequest(GET_PRODUCTS, {
      first: batchSize,
      after: cursor
    }) as ProductsResponse;

    const edges = response.products.edges;
    for (const edge of edges) {
      products.push({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        description: edge.node.description || '',
        vendor: edge.node.vendor || '',
        productType: edge.node.productType || '',
        tags: edge.node.tags || [],
        status: edge.node.status,
        createdAt: edge.node.createdAt,
        updatedAt: edge.node.updatedAt
      });
    }

    hasNextPage = response.products.pageInfo.hasNextPage;
    cursor = response.products.pageInfo.endCursor;
  }

  return products;
}

/**
 * Get a product by handle
 */
export async function getProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const response = await shopifyAdminRequest(GET_PRODUCT_BY_HANDLE, { handle }) as ProductByHandleResponse;

  if (!response.productByHandle) {
    return null;
  }

  const p = response.productByHandle;
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description || '',
    vendor: p.vendor || '',
    productType: p.productType || '',
    tags: p.tags || [],
    status: p.status
  };
}

/**
 * Get all unique tags from products
 */
export async function getAllProductTags(productLimit: number = 250): Promise<string[]> {
  const products = await getProducts(productLimit);
  const tagSet = new Set<string>();

  for (const product of products) {
    for (const tag of product.tags) {
      tagSet.add(tag);
    }
  }

  return [...tagSet].sort();
}

/**
 * Get products by tag
 */
export async function getProductsByTag(tag: string, limit: number = 50): Promise<ShopifyProduct[]> {
  const allProducts = await getProducts(limit * 2); // Fetch more since we're filtering
  return allProducts.filter(p => p.tags.includes(tag)).slice(0, limit);
}

/**
 * Get products by vendor
 */
export async function getProductsByVendor(vendor: string, limit: number = 50): Promise<ShopifyProduct[]> {
  const allProducts = await getProducts(limit * 2);
  return allProducts.filter(p => p.vendor.toLowerCase() === vendor.toLowerCase()).slice(0, limit);
}
