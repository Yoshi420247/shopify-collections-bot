#!/usr/bin/env node
/**
 * AI Assistant CLI
 *
 * Uses GPT-5.1 to provide intelligent suggestions for:
 * - Collection creation and optimization
 * - Menu structure improvements
 * - SEO content generation
 * - Product tag auditing
 */

import { program } from 'commander';
import chalk from 'chalk';
import { loadCollectionsConfig, type ConfigName } from '../config/collectionsConfig.js';
import { loadMenusConfig } from '../config/menusConfig.js';
import { loadParsedTaggingSpec } from '../config/taggingSpecLoader.js';
import { validateEnvironment, testConnection } from '../shopify/graphqlClient.js';
import { getAllCollections, type CollectionListItem } from '../shopify/collectionsApi.js';
import { getProducts } from '../shopify/productsApi.js';
import {
  isAIEnabled,
  testAIConnection,
  suggestCollections,
  generateCollectionSeo,
  auditSeoContent,
  optimizeMenuStructure,
  suggestProductTags,
  generateCollectionRules,
  parseNaturalLanguageCommand,
  type CollectionSuggestion,
  type SeoContent
} from '../ai/openaiService.js';

program
  .name('ai-assistant')
  .description('AI-powered assistant for store optimization')
  .option('--config <name>', 'Config name: wyn or oilslick', 'oilslick');

// Subcommand: Suggest new collections
program
  .command('suggest-collections')
  .description('AI analyzes your products and suggests new collections')
  .option('--limit <n>', 'Number of products to analyze', '100')
  .action(async (options) => {
    await runWithAI(async () => {
      console.log(chalk.bold('\n=== AI Collection Suggestions ===\n'));

      const products = await getProducts(parseInt(options.limit));
      console.log(`Analyzing ${products.length} products...`);

      const configName = program.opts().config as ConfigName;
      const config = loadCollectionsConfig(configName);
      const existingHandles = config.collections.map(c => c.handle);

      const productData = products.map(p => ({
        title: p.title,
        tags: p.tags,
        vendor: p.vendor,
        type: p.productType
      }));

      console.log(chalk.gray('Asking AI for suggestions...\n'));
      const suggestions = await suggestCollections(productData, existingHandles);

      console.log(chalk.green(`AI suggested ${suggestions.length} new collections:\n`));

      for (const suggestion of suggestions) {
        console.log(chalk.bold.cyan(`${suggestion.title}`));
        console.log(`  Handle: ${suggestion.handle}`);
        console.log(`  ${suggestion.description}`);
        console.log(chalk.gray(`  SEO Title: ${suggestion.seoTitle}`));
        console.log(chalk.gray(`  Rules: ${suggestion.smartRules.map(r => `${r.field}=${r.value}`).join(', ')}`));
        console.log(chalk.italic(`  Reasoning: ${suggestion.reasoning}`));
        console.log();
      }

      console.log(chalk.yellow('\nTo add these collections, update config/oilslick_collections.yml'));
    });
  });

// Subcommand: Generate SEO content
program
  .command('generate-seo <collection-handle>')
  .description('Generate SEO-optimized content for a collection')
  .action(async (handle) => {
    await runWithAI(async () => {
      console.log(chalk.bold(`\n=== AI SEO Generation for "${handle}" ===\n`));

      const configName = program.opts().config as ConfigName;
      const config = loadCollectionsConfig(configName);
      const collection = config.collections.find(c => c.handle === handle);

      if (!collection) {
        console.error(chalk.red(`Collection "${handle}" not found in config`));
        return;
      }

      // Get sample products for context
      const products = await getProducts(50);
      const sampleProducts = products.slice(0, 10).map(p => ({
        title: p.title,
        tags: p.tags
      }));

      console.log(chalk.gray('Generating SEO content...\n'));

      const seo = await generateCollectionSeo(
        collection.title,
        sampleProducts,
        {
          storeName: 'Oil Slick',
          industry: 'Extraction supplies & smoke shop',
          targetAudience: 'Cannabis extractors, concentrate enthusiasts, smoke shop customers'
        }
      );

      console.log(chalk.bold('Generated SEO Content:'));
      console.log(chalk.cyan('\nTitle:'), seo.title);
      console.log(chalk.cyan('\nDescription:'));
      console.log(seo.description);
      console.log(chalk.cyan('\nMeta Title:'), `(${seo.metaTitle.length} chars)`);
      console.log(seo.metaTitle);
      console.log(chalk.cyan('\nMeta Description:'), `(${seo.metaDescription.length} chars)`);
      console.log(seo.metaDescription);
      console.log(chalk.cyan('\nKeywords:'));
      console.log(seo.keywords.join(', '));

      console.log(chalk.yellow('\n\nTo apply, update the collection in Shopify Admin or add to config.'));
    });
  });

// Subcommand: Audit SEO
program
  .command('audit-seo')
  .description('AI audits all collections for SEO issues')
  .action(async () => {
    await runWithAI(async () => {
      console.log(chalk.bold('\n=== AI SEO Audit ===\n'));

      const collections = await getAllCollections();
      console.log(`Auditing ${collections.length} collections...\n`);

      const collectionData = collections.slice(0, 30).map((c: CollectionListItem) => ({
        handle: c.handle,
        title: c.title,
        description: c.description || '',
        seoTitle: c.seo?.title || '',
        seoDescription: c.seo?.description || ''
      }));

      console.log(chalk.gray('AI analyzing SEO quality...\n'));
      const audit = await auditSeoContent(collectionData);

      const highPriority = audit.filter(a => a.priority === 'high');
      const mediumPriority = audit.filter(a => a.priority === 'medium');
      const lowPriority = audit.filter(a => a.priority === 'low');

      console.log(chalk.bold(`Found ${audit.length} collections with SEO issues:\n`));
      console.log(chalk.red(`  High Priority: ${highPriority.length}`));
      console.log(chalk.yellow(`  Medium Priority: ${mediumPriority.length}`));
      console.log(chalk.gray(`  Low Priority: ${lowPriority.length}`));
      console.log();

      if (highPriority.length > 0) {
        console.log(chalk.red.bold('\nHigh Priority Issues:'));
        for (const item of highPriority) {
          console.log(chalk.bold(`\n${item.handle}:`));
          for (const issue of item.issues) {
            console.log(chalk.red(`  - ${issue}`));
          }
          if (item.suggestions.seoTitle) {
            console.log(chalk.green(`  Suggested title: ${item.suggestions.seoTitle}`));
          }
          if (item.suggestions.seoDescription) {
            console.log(chalk.green(`  Suggested description: ${item.suggestions.seoDescription}`));
          }
        }
      }
    });
  });

// Subcommand: Optimize menu
program
  .command('optimize-menu')
  .description('AI analyzes and suggests menu improvements')
  .action(async () => {
    await runWithAI(async () => {
      console.log(chalk.bold('\n=== AI Menu Optimization ===\n'));

      const configName = program.opts().config as ConfigName;
      const collectionsConfig = loadCollectionsConfig(configName);
      const menusConfig = loadMenusConfig(collectionsConfig, configName);

      const mainMenu = menusConfig.menus.find(m => m.handle === 'main-menu');
      if (!mainMenu) {
        console.error(chalk.red('Main menu not found'));
        return;
      }

      // Get collection product counts
      const shopifyCollections = await getAllCollections();
      const collectionsWithCounts = shopifyCollections.map((c: CollectionListItem) => ({
        handle: c.handle,
        title: c.title,
        productCount: c.productsCount || 0
      }));

      console.log(chalk.gray('AI analyzing menu structure...\n'));

      const menuData = {
        title: mainMenu.title,
        items: mainMenu.items.map(item => ({
          title: item.title,
          type: item.type,
          children: item.children?.map(child => ({
            title: child.title,
            type: child.type
          }))
        }))
      };

      const optimization = await optimizeMenuStructure(
        menuData,
        collectionsWithCounts,
        {
          industry: 'Extraction supplies & smoke shop',
          targetAudience: 'Cannabis extractors, concentrate enthusiasts, smoke shop customers'
        }
      );

      console.log(chalk.bold('Current Issues:'));
      for (const issue of optimization.currentIssues) {
        console.log(chalk.yellow(`  - ${issue}`));
      }

      console.log(chalk.bold('\nSuggested Structure:'));
      for (const item of optimization.suggestedStructure) {
        console.log(chalk.cyan(`  ${item.title}`));
        if (item.children) {
          for (const child of item.children) {
            console.log(chalk.gray(`    - ${child.title}`));
          }
        }
      }

      console.log(chalk.bold('\nReasoning:'));
      console.log(optimization.reasoning);

      console.log(chalk.bold('\nEstimated Impact:'));
      console.log(chalk.green(optimization.estimatedImpact));
    });
  });

// Subcommand: Suggest tags
program
  .command('suggest-tags')
  .description('AI suggests tags for products based on tagging spec')
  .option('--limit <n>', 'Number of products to analyze', '20')
  .action(async (options) => {
    await runWithAI(async () => {
      console.log(chalk.bold('\n=== AI Tag Suggestions ===\n'));

      const products = await getProducts(parseInt(options.limit));
      const spec = loadParsedTaggingSpec();

      console.log(`Analyzing ${products.length} products...\n`);

      const productData = products.map(p => ({
        title: p.title,
        description: p.description || '',
        vendor: p.vendor,
        type: p.productType,
        currentTags: p.tags
      }));

      const taggingSpec = {
        dimensions: spec.allowedDimensions,
        allowedValues: {
          pillar: spec.allowedPillars,
          family: spec.allowedFamilies,
          brand: spec.allowedBrands,
          material: spec.allowedMaterials,
          format: spec.allowedFormats,
          use: spec.allowedUses,
          style: spec.allowedStyles
        }
      };

      console.log(chalk.gray('AI analyzing products...\n'));
      const suggestions = await suggestProductTags(productData, taggingSpec);

      console.log(chalk.bold('Tag Suggestions:\n'));
      for (const suggestion of suggestions) {
        if (suggestion.suggestedTags.length > 0) {
          console.log(chalk.bold(suggestion.product));
          console.log(chalk.gray(`  Current: ${suggestion.currentTags.join(', ') || 'none'}`));
          console.log(chalk.green(`  Suggested: ${suggestion.suggestedTags.join(', ')}`));
          console.log(chalk.italic.gray(`  Reason: ${suggestion.reasoning}`));
          console.log(chalk.cyan(`  Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`));
          console.log();
        }
      }
    });
  });

// Subcommand: Create collection from description
program
  .command('create-collection <description>')
  .description('Create a collection from natural language description')
  .action(async (description) => {
    await runWithAI(async () => {
      console.log(chalk.bold('\n=== AI Collection Creator ===\n'));
      console.log(`Description: "${description}"\n`);

      // Get available tags
      const products = await getProducts(100);
      const allTags = [...new Set(products.flatMap(p => p.tags))];

      console.log(chalk.gray('AI generating collection rules...\n'));
      const result = await generateCollectionRules(description, allTags);

      console.log(chalk.bold('Generated Collection Configuration:\n'));
      console.log(chalk.cyan('Rules:'));
      for (const rule of result.rules) {
        console.log(`  - ${rule.field} ${rule.relation} "${rule.value}"`);
      }
      console.log(chalk.cyan(`\nLogic: ${result.disjunctive ? 'OR (any rule matches)' : 'AND (all rules must match)'}`));
      console.log(chalk.gray(`\nExplanation: ${result.explanation}`));

      console.log(chalk.yellow('\n\nYAML to add to your config:'));
      console.log(chalk.white(`
  - key: new-collection
    title: "New Collection"
    handle: "new-collection"
    group: "misc"
    type: "SMART"
    sort_order: "BEST_SELLING"
    smart_rules:
      appliedDisjunctively: ${result.disjunctive}
      conditions:
${result.rules.map(r => `        - field: "${r.field}"
          relation: "${r.relation}"
          value: "${r.value}"`).join('\n')}
`));
    });
  });

// Subcommand: Natural language command
program
  .command('ask <command...>')
  .description('Ask AI to do something in natural language')
  .action(async (commandParts) => {
    await runWithAI(async () => {
      const command = commandParts.join(' ');
      console.log(chalk.bold('\n=== AI Command Interpreter ===\n'));
      console.log(`Command: "${command}"\n`);

      const configName = program.opts().config as ConfigName;
      const config = loadCollectionsConfig(configName);
      const collectionsConfig = loadCollectionsConfig(configName);
      const menusConfig = loadMenusConfig(collectionsConfig, configName);

      const result = await parseNaturalLanguageCommand(command, {
        availableCollections: config.collections.map(c => c.handle),
        availableMenus: menusConfig.menus.map(m => m.handle)
      });

      console.log(chalk.cyan('Interpreted Intent:'), result.intent);
      console.log(chalk.cyan('Parameters:'), JSON.stringify(result.parameters, null, 2));

      if (result.clarificationNeeded) {
        console.log(chalk.yellow('\nClarification needed:'), result.clarificationNeeded);
      } else {
        console.log(chalk.green('\nReady to execute. Run the appropriate command based on the intent.'));
      }
    });
  });

// Subcommand: Test AI connection
program
  .command('test')
  .description('Test OpenAI API connection')
  .action(async () => {
    console.log(chalk.bold('\n=== Testing AI Connection ===\n'));

    if (!isAIEnabled()) {
      console.log(chalk.red('OPENAI_API_KEY not set in environment'));
      console.log(chalk.yellow('\nTo enable AI features, add your OpenAI API key:'));
      console.log(chalk.white('  export OPENAI_API_KEY=sk-your-key-here'));
      console.log(chalk.white('  # or add to .env file'));
      return;
    }

    console.log(chalk.gray('Testing connection to OpenAI...'));
    const result = await testAIConnection();

    if (result.success) {
      console.log(chalk.green(`\n Connected to ${result.model}`));
      console.log(chalk.green('AI features are ready to use!'));
    } else {
      console.log(chalk.red(`\n Connection failed: ${result.error}`));
    }
  });

program.parse();

// Helper to run AI commands with proper setup
async function runWithAI(fn: () => Promise<void>) {
  if (!isAIEnabled()) {
    console.log(chalk.red('OPENAI_API_KEY not set'));
    console.log(chalk.yellow('Run: npm run ai test'));
    process.exit(1);
  }

  try {
    validateEnvironment();
    await testConnection();
    await fn();
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
