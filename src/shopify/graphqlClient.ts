/**
 * Shopify Admin GraphQL Client
 * A typed wrapper around the Shopify Admin GraphQL API
 */

import { config as loadDotenv } from 'dotenv';

// Load environment variables
loadDotenv();

// Environment configuration
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

/**
 * Check if required environment variables are set
 */
export function validateEnvironment(): void {
  const missing: string[] = [];

  if (!SHOPIFY_STORE_DOMAIN) {
    missing.push('SHOPIFY_STORE_DOMAIN');
  }
  if (!SHOPIFY_ADMIN_API_TOKEN) {
    missing.push('SHOPIFY_ADMIN_API_TOKEN');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please create a .env file with these values. See .env.example for reference.'
    );
  }
}

/**
 * Get the Shopify GraphQL endpoint URL
 */
export function getGraphQLEndpoint(): string {
  validateEnvironment();
  return `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

/**
 * GraphQL error response type
 */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * User error type from mutations
 */
export interface UserError {
  field?: string[];
  message: string;
  code?: string;
}

/**
 * Generic GraphQL response type
 */
export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

/**
 * Custom error class for Shopify API errors
 */
export class ShopifyAPIError extends Error {
  public graphqlErrors?: GraphQLError[];
  public userErrors?: UserError[];
  public statusCode?: number;
  public operationName?: string;

  constructor(
    message: string,
    options?: {
      graphqlErrors?: GraphQLError[];
      userErrors?: UserError[];
      statusCode?: number;
      operationName?: string;
    }
  ) {
    super(message);
    this.name = 'ShopifyAPIError';
    this.graphqlErrors = options?.graphqlErrors;
    this.userErrors = options?.userErrors;
    this.statusCode = options?.statusCode;
    this.operationName = options?.operationName;
  }
}

/**
 * Execute a GraphQL request against the Shopify Admin API
 */
export async function shopifyAdminRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string
): Promise<T> {
  validateEnvironment();

  const endpoint = getGraphQLEndpoint();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN!
    },
    body: JSON.stringify({
      query,
      variables,
      operationName
    })
  });

  if (!response.ok) {
    throw new ShopifyAPIError(
      `HTTP ${response.status}: ${response.statusText}`,
      { statusCode: response.status, operationName }
    );
  }

  const result = await response.json() as GraphQLResponse<T>;

  // Check for GraphQL errors
  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map(e => e.message).join('; ');
    throw new ShopifyAPIError(
      `GraphQL errors: ${errorMessages}`,
      { graphqlErrors: result.errors, operationName }
    );
  }

  if (!result.data) {
    throw new ShopifyAPIError(
      'No data returned from GraphQL request',
      { operationName }
    );
  }

  return result.data;
}

/**
 * Helper to extract user errors from mutation responses
 */
export function checkUserErrors(
  response: { userErrors?: UserError[] },
  operationName?: string
): void {
  if (response.userErrors && response.userErrors.length > 0) {
    const errorMessages = response.userErrors.map(e => {
      const field = e.field ? `[${e.field.join('.')}] ` : '';
      return `${field}${e.message}`;
    }).join('; ');

    throw new ShopifyAPIError(
      `User errors: ${errorMessages}`,
      { userErrors: response.userErrors, operationName }
    );
  }
}

/**
 * Rate-limited request wrapper with retry logic
 */
export async function shopifyAdminRequestWithRetry<T>(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await shopifyAdminRequest<T>(query, variables, operationName);
    } catch (error) {
      lastError = error as Error;

      // Check if it's a rate limit error (429) or server error (5xx)
      if (error instanceof ShopifyAPIError) {
        if (error.statusCode === 429 || (error.statusCode && error.statusCode >= 500)) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Rate limited or server error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // For other errors, don't retry
      throw error;
    }
  }

  throw lastError;
}

/**
 * Test the API connection
 */
export async function testConnection(): Promise<{ shop: { name: string; email: string } }> {
  const query = `
    query TestConnection {
      shop {
        name
        email
      }
    }
  `;

  return shopifyAdminRequest<{ shop: { name: string; email: string } }>(query, undefined, 'TestConnection');
}
