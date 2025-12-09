#!/usr/bin/env node
/**
 * WYN Tag Audit CLI
 * Validates product tags against the tagging spec
 */

import { program } from 'commander';
import { writeFileSync } from 'fs';
import { runTagAudit, formatAuditReport, findProductCSV, loadProductData } from '../wyn/tags/tagAudit.js';

program
  .name('wyn-tag-audit')
  .description('Audit What You Need product tags against the tagging spec')
  .option('-o, --output <file>', 'Write full report to file (JSON)')
  .option('-v, --verbose', 'Show detailed error information')
  .option('--errors-only', 'Only show products with errors')
  .option('--csv <file>', 'Specify CSV file path (default: auto-detect)')
  .parse(process.argv);

const options = program.opts();

async function main(): Promise<void> {
  console.log('WYN Tag Audit');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Show which CSV we're using
    const csvPath = findProductCSV();
    console.log(`Using CSV: ${csvPath}`);
    console.log('');

    // Load products to show count
    const products = loadProductData();
    console.log(`Found ${products.length} What You Need products`);
    console.log('');

    // Run the audit
    console.log('Running tag validation...');
    console.log('');

    const summary = runTagAudit();

    // Print the report
    const report = formatAuditReport(summary);
    console.log(report);

    // Write full JSON output if requested
    if (options.output) {
      const jsonReport = {
        timestamp: new Date().toISOString(),
        csvPath,
        summary: {
          totalProducts: summary.totalProducts,
          validProducts: summary.validProducts,
          errorCount: summary.errorCount
        },
        pillarCounts: summary.pillarCounts,
        familyCounts: summary.familyCounts,
        brandCounts: summary.brandCounts,
        errors: summary.errors
      };

      writeFileSync(options.output, JSON.stringify(jsonReport, null, 2));
      console.log(`\nFull report written to: ${options.output}`);
    }

    // Exit with error code if there are validation errors
    if (summary.errorCount > 0 && summary.validProducts < summary.totalProducts) {
      console.log(`\n${summary.totalProducts - summary.validProducts} products have tag issues.`);
      process.exit(1);
    }

    console.log('\nAll products have valid tags.');
    process.exit(0);

  } catch (error) {
    console.error('Error running tag audit:', error);
    process.exit(1);
  }
}

main();
