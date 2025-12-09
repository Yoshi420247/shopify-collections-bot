#!/usr/bin/env node
/**
 * WYN Sync Menus CLI
 * Syncs menu configuration to Shopify Admin
 */

import { program } from 'commander';
import { loadCollectionsConfig, type ConfigName } from '../config/collectionsConfig.js';
import { loadMenusConfig, printMenuStructure, getMenuByHandle } from '../config/menusConfig.js';
import {
  planMenusSync,
  executeMenusSync,
  executeSeoSafeMenuSync,
  formatMenuSyncPlanReport,
  formatMenuSyncResultsReport,
  formatEnhancedSyncResultsReport,
  compareMenuStructures
} from '../wyn/menus/menusSync.js';
import { testConnection, validateEnvironment } from '../shopify/graphqlClient.js';

program
  .name('wyn-sync-menus')
  .description('Sync navigation menus to Shopify')
  .option('--config <name>', 'Config name: wyn or oilslick (default: wyn)', 'wyn')
  .option('--apply', 'Actually apply changes (default is dry-run)')
  .option('--compare', 'Show existing vs desired menu structure')
  .option('--skip-api', 'Skip Shopify API calls (config validation only)')
  .option('--menu <handle>', 'Only sync a specific menu by handle')
  .option('--seo-safe', 'Use SEO-safe sync with automatic URL redirects (recommended)')
  .option('--redirect-target <path>', 'Default redirect target for removed items', '/collections/all')
  .parse(process.argv);

const options = program.opts();

async function main(): Promise<void> {
  const configName = options.config as ConfigName;

  console.log(`Menus Sync (${configName} config)`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // Load and validate collections config first
    console.log(`Loading ${configName} collections configuration...`);
    const collectionsConfig = loadCollectionsConfig(configName);
    console.log(`Loaded ${collectionsConfig.collections.length} collection definitions`);

    // Load and validate menus config
    console.log(`Loading ${configName} menus configuration...`);
    const menusConfig = loadMenusConfig(collectionsConfig, configName);
    console.log(`Loaded ${menusConfig.menus.length} menu definitions`);
    console.log('');

    // Print menu structure preview
    console.log('Menu structure (from config):');
    console.log('-'.repeat(50));
    for (const menu of menusConfig.menus) {
      console.log(printMenuStructure(menu));
      console.log('');
    }

    // If skip-api, just validate config and exit
    if (options.skipApi) {
      console.log('Config validation passed (--skip-api mode)');
      process.exit(0);
    }

    // Validate environment
    console.log('Validating Shopify credentials...');
    validateEnvironment();

    // Test connection
    console.log('Testing Shopify API connection...');
    const shop = await testConnection();
    console.log(`Connected to: ${shop.shop.name}`);
    console.log('');

    // Show comparison if requested
    if (options.compare) {
      console.log('Comparing existing vs desired menu structure...');
      console.log('');
      const comparison = await compareMenuStructures(menusConfig);
      console.log(comparison);
      console.log('');
    }

    // Plan the sync
    console.log('Planning sync operations...');
    const { plans, collectionIdByHandle, missingCollections } = await planMenusSync(
      menusConfig,
      collectionsConfig
    );
    console.log('');

    // Print the plan
    const planReport = formatMenuSyncPlanReport(plans, missingCollections);
    console.log(planReport);
    console.log('');

    // Check for blockers
    if (missingCollections.length > 0) {
      console.log('');
      console.log('SYNC BLOCKED: Some collections are missing from Shopify.');
      console.log('Run: npm run wyn:sync-collections -- --apply');
      console.log('Then retry this command.');
      process.exit(1);
    }

    // Execute if --apply flag is set
    if (options.apply) {
      console.log('');
      console.log('Executing sync (--apply mode)...');

      if (options.seoSafe) {
        console.log('Using SEO-safe sync with automatic URL redirects...');
        console.log('');

        const results = await executeSeoSafeMenuSync(
          menusConfig,
          plans,
          collectionIdByHandle,
          {
            createRedirects: true,
            defaultRedirectTarget: options.redirectTarget || '/collections/shop-all-what-you-need'
          }
        );

        const resultsReport = formatEnhancedSyncResultsReport(results);
        console.log(resultsReport);

        if (results.errors.length > 0) {
          process.exit(1);
        }
      } else {
        console.log('');
        const results = await executeMenusSync(menusConfig, plans, collectionIdByHandle);

        const resultsReport = formatMenuSyncResultsReport(results);
        console.log(resultsReport);

        if (results.errors.length > 0) {
          process.exit(1);
        }
      }
    } else {
      console.log('');
      console.log('DRY RUN - No changes made.');
      console.log('Run with --apply to execute these changes.');
      console.log('Run with --apply --seo-safe for SEO-preserving sync with URL redirects.');
    }

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.message.includes('Missing required environment')) {
      console.error('');
      console.error('To configure Shopify credentials:');
      console.error('1. Copy .env.example to .env');
      console.error('2. Fill in your Shopify store domain and Admin API token');
    }

    process.exit(1);
  }
}

main();
