#!/usr/bin/env node
/**
 * WYN Sync Collections CLI
 * Syncs collection configuration to Shopify Admin
 */

import { program } from 'commander';
import { loadCollectionsConfig, type ConfigName } from '../config/collectionsConfig.js';
import {
  planCollectionsSync,
  executeCollectionsSync,
  formatSyncPlanReport,
  formatSyncResultsReport,
  compareProductCounts,
  formatCountComparisonReport
} from '../wyn/collections/collectionsSync.js';
import { testConnection, validateEnvironment } from '../shopify/graphqlClient.js';

program
  .name('wyn-sync-collections')
  .description('Sync collections to Shopify')
  .option('--config <name>', 'Config name: wyn or oilslick (default: wyn)', 'wyn')
  .option('--apply', 'Actually apply changes (default is dry-run)')
  .option('--publish', 'Publish newly created collections to Online Store')
  .option('--compare-counts', 'Compare expected vs actual product counts')
  .option('--skip-api', 'Skip Shopify API calls (config validation only)')
  .parse(process.argv);

const options = program.opts();

async function main(): Promise<void> {
  const configName = options.config as ConfigName;

  console.log(`Collections Sync (${configName} config)`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // Load and validate config
    console.log(`Loading ${configName} collections configuration...`);
    const config = loadCollectionsConfig(configName);
    console.log(`Loaded ${config.collections.length} collection definitions`);
    console.log('');

    // If skip-api, just validate config and exit
    if (options.skipApi) {
      console.log('Config validation passed (--skip-api mode)');
      console.log('');

      // Print collection summary
      console.log('Collections by group:');
      const groups: Record<string, number> = {};
      for (const c of config.collections) {
        groups[c.group] = (groups[c.group] || 0) + 1;
      }
      for (const [group, count] of Object.entries(groups)) {
        console.log(`  ${group}: ${count}`);
      }

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

    // Plan the sync
    console.log('Planning sync operations...');
    const plans = await planCollectionsSync(config);
    console.log('');

    // Print the plan
    const planReport = formatSyncPlanReport(plans);
    console.log(planReport);
    console.log('');

    // Compare counts if requested
    if (options.compareCounts) {
      console.log('Comparing product counts...');
      const comparisons = await compareProductCounts(config);
      const countReport = formatCountComparisonReport(comparisons);
      console.log(countReport);
      console.log('');
    }

    // Execute if --apply flag is set
    if (options.apply) {
      console.log('');
      console.log('Executing sync (--apply mode)...');
      console.log('');

      const results = await executeCollectionsSync(config, plans, {
        publish: options.publish
      });

      const resultsReport = formatSyncResultsReport(results);
      console.log(resultsReport);

      if (results.errors.length > 0) {
        process.exit(1);
      }
    } else {
      console.log('');
      console.log('DRY RUN - No changes made.');
      console.log('Run with --apply to execute these changes.');
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
