#!/usr/bin/env node
/**
 * WYN Menu Audit CLI
 *
 * Comprehensive audit of menus, collections, and SEO health.
 * Identifies:
 * - Orphaned/old menus not in config
 * - Empty collections in menus
 * - Missing collections
 * - Broken links
 * - SEO issues
 */

import { program } from 'commander';
import chalk from 'chalk';
import { loadMenusConfig } from '../config/menusConfig.js';
import { loadCollectionsConfig } from '../config/collectionsConfig.js';
import { validateEnvironment, testConnection } from '../shopify/graphqlClient.js';
import { generateMenuAuditReport } from '../wyn/menus/menusSync.js';
import { auditCollectionsSeo } from '../shopify/seoApi.js';
import { getUrlRedirects, consolidateRedirectChains } from '../shopify/redirectsApi.js';

program
  .name('wyn-menu-audit')
  .description('Comprehensive audit of WYN menus, collections, and SEO')
  .option('--seo', 'Include detailed SEO audit')
  .option('--redirects', 'Audit and optimize URL redirects')
  .option('--fix-chains', 'Automatically consolidate redirect chains')
  .option('-o, --output <file>', 'Output report to file')
  .parse(process.argv);

const options = program.opts();

async function main() {
  console.log(chalk.bold('\n=== WYN Menu & SEO Audit ===\n'));

  // Load configs
  console.log('Loading configurations...');
  const collectionsConfig = loadCollectionsConfig();
  const menusConfig = loadMenusConfig(collectionsConfig);
  console.log(chalk.green(`  Loaded ${menusConfig.menus.length} menus, ${collectionsConfig.collections.length} collections`));

  // Validate environment
  try {
    validateEnvironment();
    const shop = await testConnection();
    console.log(chalk.green(`  Connected to: ${shop.shop.name}`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }

  const reportSections: string[] = [];

  // 1. Menu Audit
  console.log('\nRunning menu audit...');
  try {
    const menuReport = await generateMenuAuditReport(menusConfig);
    reportSections.push(menuReport);
    console.log(chalk.green('  Menu audit complete'));
  } catch (error) {
    console.error(chalk.red(`  Menu audit failed: ${error}`));
  }

  // 2. SEO Audit (optional)
  if (options.seo) {
    console.log('\nRunning SEO audit...');
    try {
      const seoAudit = await auditCollectionsSeo();

      const seoLines: string[] = [];
      seoLines.push('='.repeat(70));
      seoLines.push('COLLECTION SEO AUDIT');
      seoLines.push('='.repeat(70));
      seoLines.push('');
      seoLines.push(`Total Collections: ${seoAudit.total}`);
      seoLines.push('');

      seoLines.push('ISSUES FOUND:');
      seoLines.push('-'.repeat(50));

      if (seoAudit.emptyCollections.length > 0) {
        seoLines.push(chalk.red(`\nEmpty Collections (0 products): ${seoAudit.emptyCollections.length}`));
        for (const coll of seoAudit.emptyCollections.slice(0, 10)) {
          seoLines.push(`  - ${coll.handle} (${coll.title})`);
        }
        if (seoAudit.emptyCollections.length > 10) {
          seoLines.push(`  ... and ${seoAudit.emptyCollections.length - 10} more`);
        }
      }

      if (seoAudit.missingSeoTitle.length > 0) {
        seoLines.push(chalk.yellow(`\nMissing SEO Title: ${seoAudit.missingSeoTitle.length}`));
        for (const coll of seoAudit.missingSeoTitle.slice(0, 10)) {
          seoLines.push(`  - ${coll.handle}`);
        }
        if (seoAudit.missingSeoTitle.length > 10) {
          seoLines.push(`  ... and ${seoAudit.missingSeoTitle.length - 10} more`);
        }
      }

      if (seoAudit.missingSeoDescription.length > 0) {
        seoLines.push(chalk.yellow(`\nMissing SEO Description: ${seoAudit.missingSeoDescription.length}`));
        for (const coll of seoAudit.missingSeoDescription.slice(0, 10)) {
          seoLines.push(`  - ${coll.handle}`);
        }
        if (seoAudit.missingSeoDescription.length > 10) {
          seoLines.push(`  ... and ${seoAudit.missingSeoDescription.length - 10} more`);
        }
      }

      if (seoAudit.seoTitleTooLong.length > 0) {
        seoLines.push(chalk.yellow(`\nSEO Title Too Long (>60 chars): ${seoAudit.seoTitleTooLong.length}`));
        for (const coll of seoAudit.seoTitleTooLong) {
          seoLines.push(`  - ${coll.handle} (${coll.seoTitleLength} chars)`);
        }
      }

      if (seoAudit.seoDescriptionTooLong.length > 0) {
        seoLines.push(chalk.yellow(`\nSEO Description Too Long (>160 chars): ${seoAudit.seoDescriptionTooLong.length}`));
        for (const coll of seoAudit.seoDescriptionTooLong) {
          seoLines.push(`  - ${coll.handle} (${coll.seoDescLength} chars)`);
        }
      }

      seoLines.push('');
      seoLines.push('='.repeat(70));

      reportSections.push(seoLines.join('\n'));
      console.log(chalk.green('  SEO audit complete'));
    } catch (error) {
      console.error(chalk.red(`  SEO audit failed: ${error}`));
    }
  }

  // 3. Redirects Audit (optional)
  if (options.redirects) {
    console.log('\nAuditing URL redirects...');
    try {
      const redirects = await getUrlRedirects(250);

      const redirectLines: string[] = [];
      redirectLines.push('='.repeat(70));
      redirectLines.push('URL REDIRECTS AUDIT');
      redirectLines.push('='.repeat(70));
      redirectLines.push('');
      redirectLines.push(`Total Redirects: ${redirects.length}`);
      redirectLines.push('');

      // Group by target
      const byTarget = new Map<string, number>();
      for (const redirect of redirects) {
        byTarget.set(redirect.target, (byTarget.get(redirect.target) || 0) + 1);
      }

      redirectLines.push('Redirects by Target:');
      const sortedTargets = [...byTarget.entries()].sort((a, b) => b[1] - a[1]);
      for (const [target, count] of sortedTargets.slice(0, 10)) {
        redirectLines.push(`  ${target}: ${count} redirects`);
      }

      // Find potential chains
      const sourceSet = new Set(redirects.map(r => r.path));
      const chains = redirects.filter(r => sourceSet.has(r.target));

      if (chains.length > 0) {
        redirectLines.push('');
        redirectLines.push(chalk.yellow(`Redirect Chains Found: ${chains.length}`));
        redirectLines.push('(These can hurt SEO - run with --fix-chains to consolidate)');
        for (const chain of chains.slice(0, 5)) {
          const next = redirects.find(r => r.path === chain.target);
          if (next) {
            redirectLines.push(`  ${chain.path} -> ${chain.target} -> ${next.target}`);
          }
        }
      }

      redirectLines.push('');
      redirectLines.push('='.repeat(70));

      reportSections.push(redirectLines.join('\n'));
      console.log(chalk.green(`  Found ${redirects.length} redirects`));

      // Fix chains if requested
      if (options.fixChains && chains.length > 0) {
        console.log('\nConsolidating redirect chains...');
        const result = await consolidateRedirectChains();
        console.log(chalk.green(`  Consolidated ${result.consolidated} redirect chains`));
      }
    } catch (error) {
      console.error(chalk.red(`  Redirects audit failed: ${error}`));
    }
  }

  // Output report
  const fullReport = reportSections.join('\n\n');
  console.log('\n' + fullReport);

  if (options.output) {
    const fs = await import('fs');
    fs.writeFileSync(options.output, fullReport.replace(/\x1b\[[0-9;]*m/g, '')); // Strip ANSI colors
    console.log(chalk.green(`\nReport saved to: ${options.output}`));
  }

  console.log(chalk.bold('\n=== Audit Complete ===\n'));
}

main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error}`));
  process.exit(1);
});
