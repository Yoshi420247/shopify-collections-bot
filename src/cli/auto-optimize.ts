#!/usr/bin/env node
/**
 * Auto-Optimize CLI
 *
 * Single command that runs the entire optimization pipeline:
 * 1. Analyze products with AI
 * 2. Generate/update collections
 * 3. Optimize SEO content
 * 4. Structure menus
 * 5. Deploy everything to Shopify
 */

import { program } from 'commander';
import chalk from 'chalk';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

import { loadCollectionsConfig, type ConfigName } from '../config/collectionsConfig.js';
import { loadMenusConfig } from '../config/menusConfig.js';
import { validateEnvironment, testConnection } from '../shopify/graphqlClient.js';
import { getAllCollections, type CollectionListItem } from '../shopify/collectionsApi.js';
import { getProducts } from '../shopify/productsApi.js';
import { getMenus, deleteMenu, getMenuByHandle } from '../shopify/menusApi.js';
import { planCollectionsSync, executeCollectionsSync, formatSyncPlanReport } from '../wyn/collections/collectionsSync.js';
import { planMenusSync, executeSeoSafeMenuSync, formatMenuSyncPlanReport } from '../wyn/menus/menusSync.js';
import { publishCollectionsToOnlineStore } from '../shopify/publicationsApi.js';
import {
  isAIEnabled,
  testAIConnection,
  suggestCollections,
  generateCollectionSeo,
  auditSeoContent,
  optimizeMenuStructure,
  type CollectionSuggestion
} from '../ai/openaiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

program
  .name('auto-optimize')
  .description('Fully automated store optimization with AI')
  .option('--config <name>', 'Config name: wyn or oilslick', 'oilslick')
  .option('--apply', 'Apply changes to Shopify (default: dry run)')
  .option('--publish', 'Publish new collections to Online Store')
  .option('--skip-ai', 'Skip AI analysis (use existing config only)')
  .option('--verbose', 'Show detailed output')
  .parse();

const options = program.opts();
const configName = options.config as ConfigName;
const applyChanges = options.apply === true;
const publishCollections = options.publish === true;
const skipAI = options.skipAi === true;
const verbose = options.verbose === true;

interface StepResult {
  name: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
  details?: string[];
}

const results: StepResult[] = [];

function log(message: string, indent = 0) {
  const prefix = '  '.repeat(indent);
  console.log(`${prefix}${message}`);
}

function logStep(step: number, total: number, name: string) {
  console.log(chalk.bold.blue(`\n[${'='.repeat(step)}${'-'.repeat(total - step)}] Step ${step}/${total}: ${name}`));
}

function addResult(name: string, status: 'success' | 'skipped' | 'error', message: string, details?: string[]) {
  results.push({ name, status, message, details });
}

async function main() {
  console.log(chalk.bold.magenta(`
╔══════════════════════════════════════════════════════════════════╗
║           AUTO-OPTIMIZE: Full Store Automation                  ║
║                     Powered by GPT-5.1                          ║
╚══════════════════════════════════════════════════════════════════╝
`));

  console.log(chalk.cyan('Configuration:'));
  log(`Store config: ${configName}`, 1);
  log(`Mode: ${applyChanges ? chalk.yellow('APPLY CHANGES') : chalk.green('DRY RUN')}`, 1);
  log(`Publish: ${publishCollections ? 'Yes' : 'No'}`, 1);
  log(`AI Analysis: ${skipAI ? 'Skipped' : 'Enabled'}`, 1);

  const totalSteps = skipAI ? 4 : 7;
  let currentStep = 0;

  // ===========================================================================
  // STEP 1: Validate Environment
  // ===========================================================================
  currentStep++;
  logStep(currentStep, totalSteps, 'Validating Environment');

  try {
    validateEnvironment();
    const shop = await testConnection();
    log(chalk.green(`✓ Connected to: ${shop.shop.name}`), 1);
    addResult('Environment', 'success', `Connected to ${shop.shop.name}`);
  } catch (error) {
    log(chalk.red(`✗ ${error}`), 1);
    addResult('Environment', 'error', String(error));
    printSummary();
    process.exit(1);
  }

  // Check AI if needed
  if (!skipAI) {
    if (!isAIEnabled()) {
      log(chalk.yellow('⚠ OPENAI_API_KEY not set - AI features disabled'), 1);
      log(chalk.gray('  Set OPENAI_API_KEY in .env to enable AI optimization'), 1);
      addResult('AI Connection', 'skipped', 'API key not configured');
    } else {
      const aiTest = await testAIConnection();
      if (aiTest.success) {
        log(chalk.green(`✓ AI Connected: ${aiTest.model}`), 1);
        addResult('AI Connection', 'success', `Using ${aiTest.model}`);
      } else {
        log(chalk.yellow(`⚠ AI unavailable: ${aiTest.error}`), 1);
        addResult('AI Connection', 'error', aiTest.error || 'Connection failed');
      }
    }
  }

  // ===========================================================================
  // STEP 2: Analyze Product Catalog (AI)
  // ===========================================================================
  let aiSuggestions: CollectionSuggestion[] = [];

  if (!skipAI && isAIEnabled()) {
    currentStep++;
    logStep(currentStep, totalSteps, 'AI Product Analysis');

    try {
      log('Fetching products from Shopify...', 1);
      const products = await getProducts(100);
      log(`Loaded ${products.length} products`, 1);

      const config = loadCollectionsConfig(configName);
      const existingHandles = config.collections.map(c => c.handle);

      log('AI analyzing product catalog...', 1);
      const productData = products.map(p => ({
        title: p.title,
        tags: p.tags,
        vendor: p.vendor,
        type: p.productType
      }));

      aiSuggestions = await suggestCollections(productData, existingHandles);
      log(chalk.green(`✓ AI suggested ${aiSuggestions.length} new collections`), 1);

      if (verbose && aiSuggestions.length > 0) {
        for (const s of aiSuggestions.slice(0, 5)) {
          log(chalk.gray(`  - ${s.title} (${s.handle})`), 1);
        }
        if (aiSuggestions.length > 5) {
          log(chalk.gray(`  ... and ${aiSuggestions.length - 5} more`), 1);
        }
      }

      addResult('AI Analysis', 'success', `${aiSuggestions.length} collection suggestions`,
        aiSuggestions.map(s => s.title));
    } catch (error) {
      log(chalk.yellow(`⚠ AI analysis failed: ${error}`), 1);
      addResult('AI Analysis', 'error', String(error));
    }
  }

  // ===========================================================================
  // STEP 3: SEO Audit (AI)
  // ===========================================================================
  interface SeoFix {
    handle: string;
    seoTitle?: string;
    seoDescription?: string;
  }
  let seoFixes: SeoFix[] = [];

  if (!skipAI && isAIEnabled()) {
    currentStep++;
    logStep(currentStep, totalSteps, 'AI SEO Audit');

    try {
      const collections = await getAllCollections();
      log(`Auditing ${collections.length} collections for SEO issues...`, 1);

      const collectionData = collections.slice(0, 30).map((c: CollectionListItem) => ({
        handle: c.handle,
        title: c.title,
        description: c.description || '',
        seoTitle: c.seo?.title || '',
        seoDescription: c.seo?.description || ''
      }));

      const audit = await auditSeoContent(collectionData);
      const highPriority = audit.filter(a => a.priority === 'high');

      log(chalk.green(`✓ Found ${highPriority.length} high-priority SEO issues`), 1);

      seoFixes = highPriority
        .filter(a => a.suggestions.seoTitle || a.suggestions.seoDescription)
        .map(a => ({
          handle: a.handle,
          seoTitle: a.suggestions.seoTitle,
          seoDescription: a.suggestions.seoDescription
        }));

      if (verbose && highPriority.length > 0) {
        for (const issue of highPriority.slice(0, 3)) {
          log(chalk.gray(`  - ${issue.handle}: ${issue.issues[0]}`), 1);
        }
      }

      addResult('SEO Audit', 'success', `${highPriority.length} issues found, ${seoFixes.length} fixes ready`,
        highPriority.map(h => `${h.handle}: ${h.issues[0]}`));
    } catch (error) {
      log(chalk.yellow(`⚠ SEO audit failed: ${error}`), 1);
      addResult('SEO Audit', 'error', String(error));
    }
  }

  // ===========================================================================
  // STEP 4: Menu Optimization (AI)
  // ===========================================================================
  if (!skipAI && isAIEnabled()) {
    currentStep++;
    logStep(currentStep, totalSteps, 'AI Menu Optimization');

    try {
      const collectionsConfig = loadCollectionsConfig(configName);
      const menusConfig = loadMenusConfig(collectionsConfig, configName);
      const mainMenu = menusConfig.menus.find(m => m.handle === 'main-menu');

      if (mainMenu) {
        const shopifyCollections = await getAllCollections();
        const collectionsWithCounts = shopifyCollections.map((c: CollectionListItem) => ({
          handle: c.handle,
          title: c.title,
          productCount: c.productsCount || 0
        }));

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

        log('AI analyzing menu structure...', 1);
        const optimization = await optimizeMenuStructure(
          menuData,
          collectionsWithCounts,
          {
            industry: 'Extraction supplies & smoke shop',
            targetAudience: 'Cannabis extractors, concentrate enthusiasts, smoke shop customers'
          }
        );

        log(chalk.green(`✓ Menu analysis complete`), 1);
        if (optimization.currentIssues.length > 0) {
          log(chalk.yellow(`  Issues found: ${optimization.currentIssues.length}`), 1);
          if (verbose) {
            for (const issue of optimization.currentIssues.slice(0, 3)) {
              log(chalk.gray(`    - ${issue}`), 1);
            }
          }
        }

        addResult('Menu Optimization', 'success',
          `${optimization.currentIssues.length} issues, ${optimization.suggestedStructure.length} suggested items`,
          optimization.currentIssues);
      }
    } catch (error) {
      log(chalk.yellow(`⚠ Menu optimization failed: ${error}`), 1);
      addResult('Menu Optimization', 'error', String(error));
    }
  }

  // ===========================================================================
  // STEP 5: Sync Collections
  // ===========================================================================
  currentStep++;
  logStep(currentStep, totalSteps, 'Sync Collections');

  try {
    const collectionsConfig = loadCollectionsConfig(configName);
    log(`Loaded ${collectionsConfig.collections.length} collections from config`, 1);

    log('Planning collection sync...', 1);
    const plans = await planCollectionsSync(collectionsConfig);

    const toCreate = plans.filter(p => p.action === 'create');
    const toUpdate = plans.filter(p => p.action === 'update');

    log(`  To create: ${toCreate.length}`, 1);
    log(`  To update: ${toUpdate.length}`, 1);

    if (verbose) {
      console.log(formatSyncPlanReport(plans));
    }

    if (applyChanges && (toCreate.length > 0 || toUpdate.length > 0)) {
      log(chalk.yellow('Applying collection changes...'), 1);
      const results = await executeCollectionsSync(collectionsConfig, plans);
      log(chalk.green(`✓ Created: ${results.created.length}, Updated: ${results.updated.length}`), 1);

      if (results.errors.length > 0) {
        log(chalk.red(`  Errors: ${results.errors.length}`), 1);
      }

      // Publish new collections
      if (publishCollections && results.created.length > 0) {
        log('Publishing new collections to Online Store...', 1);
        const createdIds = results.created;
        const publishResult = await publishCollectionsToOnlineStore(createdIds);
        log(chalk.green(`✓ Published ${publishResult.success.length} collections`), 1);
        if (publishResult.failed.length > 0) {
          log(chalk.yellow(`  Failed to publish: ${publishResult.failed.length}`), 1);
        }
      }

      addResult('Collections Sync', 'success',
        `Created: ${results.created.length}, Updated: ${results.updated.length}`,
        [...results.created.map(h => `+ ${h}`), ...results.updated.map(h => `~ ${h}`)]);
    } else if (!applyChanges) {
      log(chalk.gray('  (Dry run - no changes applied)'), 1);
      addResult('Collections Sync', 'skipped', 'Dry run mode',
        [`Would create: ${toCreate.length}`, `Would update: ${toUpdate.length}`]);
    } else {
      log(chalk.green('✓ Collections already in sync'), 1);
      addResult('Collections Sync', 'success', 'Already in sync');
    }
  } catch (error) {
    log(chalk.red(`✗ Collection sync failed: ${error}`), 1);
    addResult('Collections Sync', 'error', String(error));
  }

  // ===========================================================================
  // STEP 6: Cleanup & Sync Menus
  // ===========================================================================
  currentStep++;
  logStep(currentStep, totalSteps, 'Cleanup & Sync Menus');

  try {
    const collectionsConfig = loadCollectionsConfig(configName);
    const menusConfig = loadMenusConfig(collectionsConfig, configName);
    log(`Loaded ${menusConfig.menus.length} menus from config`, 1);

    // First, show ALL existing menus in Shopify for diagnostics
    log('Fetching all existing menus from Shopify...', 1);
    const allMenus = await getMenus(100);
    log(chalk.cyan(`  Found ${allMenus.length} total menus in Shopify:`), 1);
    for (const menu of allMenus) {
      log(chalk.gray(`    - "${menu.title}" (handle: ${menu.handle}) [${menu.id}]`), 1);
    }

    const configuredHandles = menusConfig.menus.map(m => m.handle.toLowerCase());

    // CLEANUP: Delete duplicate/old menus specified in config
    if (menusConfig.cleanup_menus && menusConfig.cleanup_menus.length > 0) {
      const menusToCleanup = allMenus.filter(m =>
        menusConfig.cleanup_menus!.some(h => h.toLowerCase() === m.handle.toLowerCase())
      );
      if (menusToCleanup.length > 0) {
        log(chalk.yellow(`  Cleaning up ${menusToCleanup.length} duplicate menus...`), 1);
        if (applyChanges) {
          for (const menuToDelete of menusToCleanup) {
            const result = await deleteMenu(menuToDelete.id);
            if (result.success) {
              log(chalk.green(`    ✓ Deleted: ${menuToDelete.handle}`), 1);
            } else {
              log(chalk.red(`    ✗ Failed to delete ${menuToDelete.handle}: ${result.error}`), 1);
            }
          }
        } else {
          for (const m of menusToCleanup) {
            log(chalk.gray(`    - Would delete: ${m.handle}`), 1);
          }
        }
      }
    }

    // Find menus that match our configured handles
    const menusToUpdate = allMenus.filter(m =>
      configuredHandles.includes(m.handle.toLowerCase())
    );

    if (menusToUpdate.length > 0) {
      log(chalk.yellow(`  Will update ${menusToUpdate.length} menu(s):`), 1);
      for (const menu of menusToUpdate) {
        // Get full menu details to show current state
        const fullMenu = await getMenuByHandle(menu.handle);
        const itemCount = fullMenu ? fullMenu.items.length : 0;
        log(chalk.gray(`    - ${menu.handle}: currently has ${itemCount} top-level items`), 1);
        if (fullMenu && verbose) {
          for (const item of fullMenu.items.slice(0, 5)) {
            log(chalk.gray(`      • ${item.title} (${item.type})`), 1);
          }
          if (fullMenu.items.length > 5) {
            log(chalk.gray(`      ... and ${fullMenu.items.length - 5} more`), 1);
          }
        }
      }
    }

    log('Planning menu sync...', 1);
    const { plans, collectionIdByHandle, missingCollections } = await planMenusSync(menusConfig, collectionsConfig);

    if (missingCollections.length > 0) {
      log(chalk.yellow(`  Warning: ${missingCollections.length} collections not found`), 1);
      if (verbose) {
        for (const handle of missingCollections.slice(0, 5)) {
          log(chalk.gray(`    - ${handle}`), 1);
        }
      }
    }

    const toCreate = plans.filter(p => p.action === 'create');
    const toUpdate = plans.filter(p => p.action === 'update');

    log(`  To create: ${toCreate.length}`, 1);
    log(`  To update: ${toUpdate.length}`, 1);

    if (verbose) {
      console.log(formatMenuSyncPlanReport(plans, missingCollections));
    }

    if (applyChanges && (toCreate.length > 0 || toUpdate.length > 0)) {
      log(chalk.yellow('Applying menu changes with SEO-safe sync...'), 1);
      const results = await executeSeoSafeMenuSync(menusConfig, plans, collectionIdByHandle, {
        createRedirects: true,
        defaultRedirectTarget: '/collections/all'
      });

      log(chalk.green(`✓ Created: ${results.created.length}, Updated: ${results.updated.length}`), 1);

      if (results.redirectsCreated.length > 0) {
        log(chalk.green(`  URL redirects created: ${results.redirectsCreated.length}`), 1);
      }

      if (results.errors.length > 0) {
        log(chalk.red(`  Errors: ${results.errors.length}`), 1);
        for (const err of results.errors) {
          log(chalk.red(`    ✗ ${err.handle}: ${err.error}`), 1);
        }
      }

      // VERIFICATION: Show what the menu looks like now
      if (results.updated.length > 0 || results.created.length > 0) {
        log(chalk.cyan('\n  Verifying menu update...'), 1);
        for (const handle of [...results.updated, ...results.created]) {
          const verifyMenu = await getMenuByHandle(handle);
          if (verifyMenu) {
            log(chalk.green(`  ✓ ${handle} now has ${verifyMenu.items.length} top-level items:`), 1);
            for (const item of verifyMenu.items.slice(0, 8)) {
              const hasChildren = item.items && item.items.length > 0 ? ` (${item.items.length} children)` : '';
              log(chalk.gray(`      • ${item.title}${hasChildren}`), 1);
            }
            if (verifyMenu.items.length > 8) {
              log(chalk.gray(`      ... and ${verifyMenu.items.length - 8} more top-level items`), 1);
            }
          } else {
            log(chalk.red(`  ✗ Could not verify ${handle} - menu not found after update`), 1);
          }
        }
      }

      addResult('Menus Sync', 'success',
        `Created: ${results.created.length}, Updated: ${results.updated.length}, Redirects: ${results.redirectsCreated.length}`,
        [...results.created.map(h => `+ ${h}`), ...results.updated.map(h => `~ ${h}`)]);
    } else if (!applyChanges) {
      log(chalk.gray('  (Dry run - no changes applied)'), 1);
      addResult('Menus Sync', 'skipped', 'Dry run mode',
        [`Would create: ${toCreate.length}`, `Would update: ${toUpdate.length}`]);
    } else {
      log(chalk.green('✓ Menus already in sync'), 1);
      addResult('Menus Sync', 'success', 'Already in sync');
    }
  } catch (error) {
    log(chalk.red(`✗ Menu sync failed: ${error}`), 1);
    addResult('Menus Sync', 'error', String(error));
  }

  // ===========================================================================
  // FINAL SUMMARY
  // ===========================================================================
  printSummary();
}

function printSummary() {
  console.log(chalk.bold.magenta(`
╔══════════════════════════════════════════════════════════════════╗
║                        OPTIMIZATION SUMMARY                      ║
╚══════════════════════════════════════════════════════════════════╝
`));

  const successCount = results.filter(r => r.status === 'success').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  for (const result of results) {
    const icon = result.status === 'success' ? chalk.green('✓') :
                 result.status === 'skipped' ? chalk.yellow('○') :
                 chalk.red('✗');
    const color = result.status === 'success' ? chalk.green :
                  result.status === 'skipped' ? chalk.yellow :
                  chalk.red;

    console.log(`${icon} ${chalk.bold(result.name)}: ${color(result.message)}`);

    if (result.details && result.details.length > 0 && options.verbose) {
      for (const detail of result.details.slice(0, 5)) {
        console.log(chalk.gray(`    ${detail}`));
      }
      if (result.details.length > 5) {
        console.log(chalk.gray(`    ... and ${result.details.length - 5} more`));
      }
    }
  }

  console.log();
  console.log(chalk.bold('Results:'));
  console.log(`  ${chalk.green(`${successCount} succeeded`)} | ${chalk.yellow(`${skippedCount} skipped`)} | ${chalk.red(`${errorCount} failed`)}`);

  if (!options.apply) {
    console.log();
    console.log(chalk.yellow.bold('This was a DRY RUN. To apply changes, run:'));
    console.log(chalk.white(`  npm run auto-optimize -- --apply --publish`));
  }

  console.log();
}

main().catch(error => {
  console.error(chalk.red(`\nFatal error: ${error}`));
  process.exit(1);
});
