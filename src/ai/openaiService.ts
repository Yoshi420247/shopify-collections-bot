/**
 * OpenAI Service Module
 * Provides AI-powered intelligence for collections, menus, and SEO optimization
 * Uses GPT-5.1 (latest model as of December 2025)
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5.1';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Get OpenAI API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for AI features');
  }
  return apiKey;
}

/**
 * Make a request to OpenAI API
 */
async function callOpenAI(
  messages: OpenAIMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'text' | 'json';
  } = {}
): Promise<string> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_completion_tokens: options.maxTokens ?? 2000,  // GPT-5.1 uses max_completion_tokens
  };

  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as OpenAIResponse;
  return data.choices[0]?.message?.content || '';
}

// =============================================================================
// COLLECTION INTELLIGENCE
// =============================================================================

export interface CollectionSuggestion {
  title: string;
  handle: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  smartRules: {
    field: string;
    relation: string;
    value: string;
  }[];
  reasoning: string;
}

/**
 * Analyze products and suggest new collections
 */
export async function suggestCollections(
  products: Array<{ title: string; tags: string[]; vendor: string; type: string }>,
  existingCollections: string[]
): Promise<CollectionSuggestion[]> {
  const systemPrompt = `You are an e-commerce expert specializing in Shopify store optimization.
Analyze the product catalog and suggest new smart collections that would improve navigation and sales.

Consider:
- Product families and categories
- Brand groupings
- Use cases (dabbing, smoking, rolling, etc.)
- Price tiers
- Material types (glass, silicone, quartz)
- Themed collections (travel-friendly, made in USA, heady glass)

Return JSON with an array of collection suggestions.`;

  const userPrompt = `Here are the products (sample of ${products.length} items):
${JSON.stringify(products.slice(0, 50), null, 2)}

Existing collections: ${existingCollections.join(', ')}

Suggest 5-10 NEW collections that don't overlap with existing ones.
Each suggestion should include:
- title: Display name
- handle: URL slug (lowercase, hyphens)
- description: 1-2 sentence description
- seoTitle: SEO-optimized title (max 60 chars)
- seoDescription: SEO meta description (max 160 chars)
- smartRules: Array of {field, relation, value} for Shopify smart collection rules
- reasoning: Why this collection would be valuable

Return as JSON: { "suggestions": [...] }`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.8 }
  );

  const parsed = JSON.parse(response);
  return parsed.suggestions || [];
}

/**
 * Generate smart collection rules from natural language
 */
export async function generateCollectionRules(
  description: string,
  availableTags: string[]
): Promise<{
  rules: Array<{ field: string; relation: string; value: string }>;
  disjunctive: boolean;
  explanation: string;
}> {
  const systemPrompt = `You are a Shopify smart collection rule expert.
Convert natural language collection descriptions into Shopify smart collection rules.

Available rule fields:
- TAG: Match product tags (format: dimension:value, e.g., "brand:raw", "family:glass-bong")
- VENDOR: Match product vendor
- PRODUCT_TYPE: Match product type
- VARIANT_PRICE: Match price (use with GREATER_THAN, LESS_THAN)

Relations: EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, STARTS_WITH, CONTAINS`;

  const userPrompt = `Collection description: "${description}"

Available tags in the catalog:
${availableTags.slice(0, 100).join('\n')}

Generate smart collection rules. Return JSON:
{
  "rules": [{ "field": "TAG", "relation": "EQUALS", "value": "..." }, ...],
  "disjunctive": true/false (true = OR logic, false = AND logic),
  "explanation": "Brief explanation of the rule logic"
}`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.3 }
  );

  return JSON.parse(response);
}

// =============================================================================
// SEO INTELLIGENCE
// =============================================================================

export interface SeoContent {
  title: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

/**
 * Generate SEO-optimized content for a collection
 */
export async function generateCollectionSeo(
  collectionTitle: string,
  productSamples: Array<{ title: string; tags: string[] }>,
  storeContext: {
    storeName: string;
    industry: string;
    targetAudience: string;
  }
): Promise<SeoContent> {
  const systemPrompt = `You are an SEO expert for e-commerce stores.
Generate optimized SEO content for Shopify collections.

Guidelines:
- Meta title: 50-60 characters, include primary keyword
- Meta description: 150-160 characters, compelling call-to-action
- Description: 2-3 sentences, natural keyword placement
- Keywords: 5-8 relevant search terms`;

  const userPrompt = `Store: ${storeContext.storeName}
Industry: ${storeContext.industry}
Target Audience: ${storeContext.targetAudience}

Collection: "${collectionTitle}"
Sample products: ${productSamples.slice(0, 10).map(p => p.title).join(', ')}

Generate SEO content. Return JSON:
{
  "title": "Collection display title",
  "description": "Rich collection description (HTML allowed)",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "SEO description under 160 chars",
  "keywords": ["keyword1", "keyword2", ...]
}`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.6 }
  );

  return JSON.parse(response);
}

/**
 * Audit and improve existing SEO content
 */
export async function auditSeoContent(
  collections: Array<{
    handle: string;
    title: string;
    description: string;
    seoTitle: string;
    seoDescription: string;
  }>
): Promise<Array<{
  handle: string;
  issues: string[];
  suggestions: {
    seoTitle?: string;
    seoDescription?: string;
    description?: string;
  };
  priority: 'high' | 'medium' | 'low';
}>> {
  const systemPrompt = `You are an SEO auditor for e-commerce.
Analyze collection SEO content and identify issues.

Check for:
- Missing or empty SEO fields
- Title too long (>60 chars) or too short (<30 chars)
- Description too long (>160 chars) or too short (<100 chars)
- Missing keywords
- Duplicate content
- Poor call-to-action`;

  const userPrompt = `Audit these collections for SEO issues:
${JSON.stringify(collections, null, 2)}

Return JSON array:
[{
  "handle": "collection-handle",
  "issues": ["Issue 1", "Issue 2"],
  "suggestions": { "seoTitle": "...", "seoDescription": "..." },
  "priority": "high|medium|low"
}, ...]`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.4 }
  );

  return JSON.parse(response);
}

// =============================================================================
// MENU INTELLIGENCE
// =============================================================================

export interface MenuOptimization {
  currentIssues: string[];
  suggestedStructure: {
    title: string;
    children?: { title: string; handle: string }[];
  }[];
  reasoning: string;
  estimatedImpact: string;
}

/**
 * Analyze menu structure and suggest optimizations
 */
export async function optimizeMenuStructure(
  currentMenu: {
    title: string;
    items: Array<{
      title: string;
      type: string;
      children?: Array<{ title: string; type: string }>;
    }>;
  },
  collections: Array<{ handle: string; title: string; productCount: number }>,
  storeContext: {
    industry: string;
    targetAudience: string;
  }
): Promise<MenuOptimization> {
  const systemPrompt = `You are a UX expert specializing in e-commerce navigation.
Analyze menu structures and suggest improvements based on:

- Cognitive load (7±2 rule for top-level items)
- Customer journey optimization
- Mobile-first design principles
- Clear category hierarchy
- Balanced dropdown depth (2-3 levels max)
- High-traffic items should be prominent`;

  const userPrompt = `Current menu structure:
${JSON.stringify(currentMenu, null, 2)}

Available collections (with product counts):
${collections.map(c => `${c.title} (${c.productCount} products)`).join('\n')}

Store context:
- Industry: ${storeContext.industry}
- Target audience: ${storeContext.targetAudience}

Analyze and optimize. Return JSON:
{
  "currentIssues": ["Issue 1", "Issue 2"],
  "suggestedStructure": [
    { "title": "Category", "children": [{ "title": "Subcategory", "handle": "handle" }] }
  ],
  "reasoning": "Explanation of changes",
  "estimatedImpact": "Expected improvement"
}`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.7 }
  );

  return JSON.parse(response);
}

// =============================================================================
// TAGGING INTELLIGENCE
// =============================================================================

export interface TagSuggestion {
  product: string;
  currentTags: string[];
  suggestedTags: string[];
  reasoning: string;
  confidence: number;
}

/**
 * Analyze products and suggest tags based on the tagging spec
 */
export async function suggestProductTags(
  products: Array<{ title: string; description: string; vendor: string; type: string; currentTags: string[] }>,
  taggingSpec: {
    dimensions: string[];
    allowedValues: Record<string, string[]>;
  }
): Promise<TagSuggestion[]> {
  const systemPrompt = `You are a product tagging specialist.
Analyze products and suggest structured tags following the tagging specification.

Tag format: dimension:value (e.g., "family:glass-bong", "brand:raw", "material:quartz")

Be precise and consistent. Only suggest tags that match the allowed values.`;

  const userPrompt = `Tagging specification:
Dimensions: ${taggingSpec.dimensions.join(', ')}
Allowed values:
${Object.entries(taggingSpec.allowedValues).map(([dim, vals]) => `${dim}: ${vals.join(', ')}`).join('\n')}

Products to tag:
${JSON.stringify(products.slice(0, 20), null, 2)}

Suggest tags for each product. Return JSON:
{
  "suggestions": [{
    "product": "Product title",
    "currentTags": ["existing", "tags"],
    "suggestedTags": ["new:tag1", "new:tag2"],
    "reasoning": "Why these tags fit",
    "confidence": 0.95
  }, ...]
}`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.3 }
  );

  const parsed = JSON.parse(response);
  return parsed.suggestions || [];
}

/**
 * Validate and fix tag inconsistencies
 */
export async function auditProductTags(
  products: Array<{ title: string; tags: string[] }>,
  taggingSpec: {
    dimensions: string[];
    allowedValues: Record<string, string[]>;
  }
): Promise<Array<{
  product: string;
  issues: string[];
  fixes: { remove?: string[]; add?: string[] };
}>> {
  const systemPrompt = `You are a data quality specialist for product catalogs.
Identify tagging inconsistencies and suggest fixes.

Look for:
- Typos in tag values
- Missing required dimensions (pillar, family)
- Conflicting tags
- Deprecated or non-standard values
- Case inconsistencies`;

  const userPrompt = `Tagging specification:
${JSON.stringify(taggingSpec, null, 2)}

Products to audit:
${JSON.stringify(products.slice(0, 30), null, 2)}

Find issues and suggest fixes. Return JSON array:
[{
  "product": "Product title",
  "issues": ["Issue description"],
  "fixes": { "remove": ["bad:tag"], "add": ["correct:tag"] }
}, ...]`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.3 }
  );

  return JSON.parse(response);
}

// =============================================================================
// NATURAL LANGUAGE INTERFACE
// =============================================================================

export interface NLCommand {
  intent: 'create_collection' | 'update_menu' | 'suggest_seo' | 'audit_tags' | 'unknown';
  parameters: Record<string, unknown>;
  clarificationNeeded?: string;
}

/**
 * Parse natural language commands into structured actions
 */
export async function parseNaturalLanguageCommand(
  command: string,
  context: {
    availableCollections: string[];
    availableMenus: string[];
  }
): Promise<NLCommand> {
  const systemPrompt = `You are a command interpreter for a Shopify store management tool.
Parse natural language commands into structured actions.

Available intents:
- create_collection: Create a new smart collection
- update_menu: Modify menu structure
- suggest_seo: Generate SEO content
- audit_tags: Check product tagging
- unknown: Command not recognized

Extract relevant parameters from the command.`;

  const userPrompt = `Command: "${command}"

Context:
- Available collections: ${context.availableCollections.slice(0, 20).join(', ')}
- Available menus: ${context.availableMenus.join(', ')}

Parse the command. Return JSON:
{
  "intent": "create_collection|update_menu|suggest_seo|audit_tags|unknown",
  "parameters": { ... extracted parameters ... },
  "clarificationNeeded": "Question if command is ambiguous (optional)"
}`;

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { responseFormat: 'json', temperature: 0.3 }
  );

  return JSON.parse(response);
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if OpenAI API is configured
 */
export function isAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Test OpenAI connection
 */
export async function testAIConnection(): Promise<{ success: boolean; model: string; error?: string }> {
  try {
    const response = await callOpenAI(
      [{ role: 'user', content: 'Say "OK" if you can hear me.' }],
      { maxTokens: 10 }
    );
    return { success: true, model: MODEL };
  } catch (error) {
    return {
      success: false,
      model: MODEL,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
