#!/usr/bin/env node
/**
 * WYN SEO-Safe Sync CLI
 *
 * Unified command that:
 * 1. Syncs collections from YAML config
 * 2. Creates URL redirects for removed/changed collection links
 * 3. Syncs menus with redirect preservation
 * 4. Reports on SEO impact
 *
 * This is the recommended way to update your store - it preserves your SEO!
 */

import { program } from 'commander';
import chalk from 'chalk';
import { loadMenusConfig } from '../config/menusConfig.js';
import { loadCollectionsConfig } from '../config/collectionsConfig.js';
import { validateEnvironment, testConnection } from '../shopify/graphqlClient.js';
import { planCollectionsSync, executeCollectionsSync } from '../wyn/collections/collectionsSync.js';
import {
  planMenusSync,
  executeSeoSafeMenuSync,
  formatEnhancedSyncResultsReport,
  formatMenuSyncPlanReport
} from '../wyn/menus/menusSync.js';
// Note: Publishing requires collection IDs - use wyn:sync-collections --publish instead

program
  .name('wyn-seo-safe-sync')
  .description('SEO-safe sync of collections and menus with automatic redirect preservation')
  .option('--apply', 'Actually apply changes (default is dry-run)')
  .option('--collections-only', 'Only sync collections')
  .option('--menus-only', 'Only sync menus')
  .option('--publish', 'Publish new collections to Online Store')
  .option('--no-redirects', 'Skip creating URL redirects (not recommended)')
  .option('--redirect-target <path>', 'Default redirect target for removed items', '/collections/shop-all-what-you-need')
  .option('--verbose', 'Show detailed output')
  .parse(process.argv);

const options = program.opts();

async function main() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║           WYN SEO-SAFE SYNC - Collections & Menus                  ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════════╝\n'));

  if (!options.apply) {
    console.log(chalk.yellow('DRY RUN MODE - No changes will be made'));
    console.log(chalk.yellow('Run with --apply to execute changes\n'));
  }

  // Load configs
  console.log(chalk.blue('Loading configurations...'));
  const collectionsConfig = loadCollectionsConfig();
  const menusConfig = loadMenusConfig(collectionsConfig);
  console.log(chalk.green(`  ✓ Loaded ${collectionsConfig.collections.length} collections`));
  console.log(chalk.green(`  ✓ Loaded ${menusConfig.menus.length} menus\n`));

  // Validate environment
  try {
    validateEnvironment();
    const shop = await testConnection();
    console.log(chalk.green(`  ✓ Connected to: ${shop.shop.name}\n`));
  } catch (error) {
    console.error(chalk.red(`\n✗ Connection failed: ${error}`));
    process.exit(1);
  }

  const summary = {
    collectionsCreated: 0,
    collectionsUpdated: 0,
    collectionsPublished: 0,
    menusCreated: 0,
    menusUpdated: 0,
    redirectsCreated: 0,
    errors: [] as string[]
  };

  // ===== PHASE 1: Collections Sync =====
  if (!options.menusOnly) {
    console.log(chalk.bold.blue('\n━━━ PHASE 1: Collections Sync ━━━\n'));

    try {
      console.log('Planning collections sync...');
      const collectionsPlans = await planCollectionsSync(collectionsConfig);

      const creates = collectionsPlans.filter(p => p.action === 'create');
      const updates = collectionsPlans.filter(p => p.action === 'update');

      console.log(`  ${creates.length} to create, ${updates.length} to update\n`);

      if (options.apply && (creates.length > 0 || updates.length > 0)) {
        console.log('Executing collections sync...');
        const results = await executeCollectionsSync(collectionsConfig, collectionsPlans);

        summary.collectionsCreated = results.created.length;
        summary.collectionsUpdated = results.updated.length;

        if (results.errors.length > 0) {
          for (const err of results.errors) {
            summary.errors.push(`Collection ${err.handle}: ${err.error}`);
          }
        }

        console.log(chalk.green(`  ✓ Created: ${results.created.length}`));
        console.log(chalk.green(`  ✓ Updated: ${results.updated.length}`));

        // Note about publishing
        if (options.publish && results.created.length > 0) {
          console.log(chalk.yellow('\n  ⚠ To publish collections, use: npm run wyn:sync-collections -- --apply --publish'));
          console.log(chalk.yellow('    The SEO-safe sync focuses on menu redirect preservation.'));
        }
      } else if (!options.apply) {
        console.log('Would create:');
        for (const plan of creates.slice(0, 10)) {
          console.log(`  + ${plan.handle}`);
        }
        if (creates.length > 10) console.log(`  ... and ${creates.length - 10} more`);

        console.log('\nWould update:');
        for (const plan of updates.slice(0, 10)) {
          console.log(`  ~ ${plan.handle}`);
        }
        if (updates.length > 10) console.log(`  ... and ${updates.length - 10} more`);
      }
    } catch (error) {
      console.error(chalk.red(`Collections sync failed: ${error}`));
      summary.errors.push(`Collections sync: ${error}`);
    }
  }

  // ===== PHASE 2: Menu Sync with Redirects =====
  if (!options.collectionsOnly) {
    console.log(chalk.bold.blue('\n━━━ PHASE 2: SEO-Safe Menu Sync ━━━\n'));

    try {
      console.log('Planning menu sync...');
      const { plans, collectionIdByHandle, missingCollections } = await planMenusSync(
        menusConfig,
        collectionsConfig
      );

      if (missingCollections.length > 0) {
        console.log(chalk.yellow(`\n⚠ Missing collections: ${missingCollections.join(', ')}`));
        console.log(chalk.yellow('  These must be synced first.\n'));
      }

      const creates = plans.filter(p => p.action === 'create');
      const updates = plans.filter(p => p.action === 'update');
      const blocked = plans.filter(p => p.changes?.some(c => c.startsWith('BLOCKED')));

      console.log(`  ${creates.length} to create, ${updates.length} to update, ${blocked.length} blocked\n`);

      if (options.apply && (creates.length > 0 || updates.length > 0)) {
        const createRedirects = options.redirects !== false;

        if (createRedirects) {
          console.log(chalk.cyan('Creating URL redirects for removed menu items...'));
        }

        const results = await executeSeoSafeMenuSync(
          menusConfig,
          plans,
          collectionIdByHandle,
          {
            createRedirects,
            defaultRedirectTarget: options.redirectTarget || '/collections/shop-all-what-you-need'
          }
        );

        summary.menusCreated = results.created.length;
        summary.menusUpdated = results.updated.length;
        summary.redirectsCreated = results.redirectsCreated.length;

        if (results.errors.length > 0) {
          for (const err of results.errors) {
            summary.errors.push(`Menu ${err.handle}: ${err.error}`);
          }
        }

        console.log(chalk.green(`\n  ✓ Menus created: ${results.created.length}`));
        console.log(chalk.green(`  ✓ Menus updated: ${results.updated.length}`));

        if (createRedirects) {
          console.log(chalk.green(`  ✓ Redirects created: ${results.redirectsCreated.length}`));
          if (results.redirectsCreated.length > 0 && options.verbose) {
            for (const redirect of results.redirectsCreated) {
              console.log(chalk.gray(`      ${redirect.path} → ${redirect.target}`));
            }
          }
        }
      } else if (!options.apply) {
        console.log(formatMenuSyncPlanReport(plans, missingCollections));
      }
    } catch (error) {
      console.error(chalk.red(`Menu sync failed: ${error}`));
      summary.errors.push(`Menu sync: ${error}`);
    }
  }

  // ===== SUMMARY =====
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                         SYNC SUMMARY                               ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════════╝\n'));

  if (options.apply) {
    console.log(chalk.bold('CHANGES APPLIED:'));
    console.log(`  Collections created:   ${summary.collectionsCreated}`);
    console.log(`  Collections updated:   ${summary.collectionsUpdated}`);
    if (options.publish) {
      console.log(`  Collections published: ${summary.collectionsPublished}`);
    }
    console.log(`  Menus created:         ${summary.menusCreated}`);
    console.log(`  Menus updated:         ${summary.menusUpdated}`);
    console.log(`  Redirects created:     ${summary.redirectsCreated}`);

    if (summary.errors.length > 0) {
      console.log(chalk.red(`\nERRORS (${summary.errors.length}):`));
      for (const err of summary.errors) {
        console.log(chalk.red(`  ✗ ${err}`));
      }
    }

    if (summary.redirectsCreated > 0) {
      console.log(chalk.green('\n✓ SEO preserved! Old URLs will redirect to new locations.'));
    }
  } else {
    console.log(chalk.yellow('DRY RUN - No changes were made'));
    console.log(chalk.yellow('\nRun with --apply to execute these changes'));
    console.log(chalk.yellow('Example: npm run wyn:seo-safe-sync -- --apply --publish'));
  }

  console.log('');
}

main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error}`));
  process.exit(1);
});
