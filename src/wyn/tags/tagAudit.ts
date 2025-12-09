/**
 * Tag Audit Module
 * Validates product tags in the CSV against the tagging spec
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import type { ProductTagData, TagAuditError, TagAuditSummary, ParsedTaggingSpec } from '../../types.js';
import { loadParsedTaggingSpec, validateTag } from '../../config/taggingSpecLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');

/**
 * Find the WYN product export CSV file
 */
export function findProductCSV(): string {
  const files = readdirSync(DATA_DIR);

  const csvFile = files.find(f =>
    f.toUpperCase().includes('WYN_PRODUCT_EXPORT_TAGGED') &&
    f.endsWith('.csv')
  );

  if (!csvFile) {
    throw new Error(
      'Could not find WYN product export CSV. Expected a file containing "WYN_PRODUCT_EXPORT_TAGGED" in data/ directory.'
    );
  }

  return join(DATA_DIR, csvFile);
}

/**
 * Parse the CSV file and extract product tag data
 */
export function loadProductData(): ProductTagData[] {
  const csvPath = findProductCSV();
  const content = readFileSync(csvPath, 'utf-8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;

  // Filter to What You Need vendor and extract tag data
  const products: ProductTagData[] = [];

  for (const record of records) {
    const vendor = record['Vendor'] || '';

    // Only process What You Need products
    if (vendor !== 'What You Need') {
      continue;
    }

    const tagsStr = record['Tags'] || '';
    const tags = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    products.push({
      handle: record['Handle'] || '',
      title: record['Title'] || '',
      vendor,
      type: record['Type'] || '',
      tags
    });
  }

  return products;
}

/**
 * Parse a tag into dimension and value
 */
function parseTag(tag: string): { dimension: string; value: string } | null {
  if (!tag.includes(':')) {
    return null;
  }
  const [dimension, ...valueParts] = tag.split(':');
  return {
    dimension,
    value: valueParts.join(':')
  };
}

/**
 * Validate a single product's tags
 */
function validateProductTags(
  product: ProductTagData,
  spec: ParsedTaggingSpec
): TagAuditError[] {
  const errors: TagAuditError[] = [];

  // Count tags by dimension
  const pillarTags: string[] = [];
  const familyTags: string[] = [];
  const formatTags: string[] = [];
  const useTags: string[] = [];

  for (const tag of product.tags) {
    const parsed = parseTag(tag);
    if (!parsed) {
      // Tag doesn't have dimension:value format
      // Only report if it looks like it should be a structured tag
      if (tag.includes('-') || tag.match(/^[a-z]+$/)) {
        errors.push({
          handle: product.handle,
          title: product.title,
          errorType: 'unknown_dimension',
          message: `Tag "${tag}" is not in dimension:value format`,
          tags: product.tags
        });
      }
      continue;
    }

    const { dimension, value } = parsed;

    // Track counts
    switch (dimension) {
      case 'pillar':
        pillarTags.push(value);
        break;
      case 'family':
        familyTags.push(value);
        break;
      case 'format':
        formatTags.push(value);
        break;
      case 'use':
        useTags.push(value);
        break;
    }

    // Validate tag
    const validation = validateTag(tag, spec);
    if (!validation.valid) {
      errors.push({
        handle: product.handle,
        title: product.title,
        errorType: 'unknown_value',
        message: validation.error || `Invalid tag "${tag}"`,
        tags: product.tags
      });
    }
  }

  // Check for required tags
  if (pillarTags.length === 0) {
    errors.push({
      handle: product.handle,
      title: product.title,
      errorType: 'missing_pillar',
      message: 'Missing pillar tag',
      tags: product.tags
    });
  } else if (pillarTags.length > 1) {
    errors.push({
      handle: product.handle,
      title: product.title,
      errorType: 'multiple_pillars',
      message: `Multiple pillar tags found: ${pillarTags.join(', ')}`,
      tags: product.tags
    });
  }

  if (familyTags.length === 0) {
    errors.push({
      handle: product.handle,
      title: product.title,
      errorType: 'missing_family',
      message: 'Missing family tag',
      tags: product.tags
    });
  } else if (familyTags.length > 1) {
    errors.push({
      handle: product.handle,
      title: product.title,
      errorType: 'multiple_families',
      message: `Multiple family tags found: ${familyTags.join(', ')}`,
      tags: product.tags
    });
  }

  if (formatTags.length === 0) {
    errors.push({
      handle: product.handle,
      title: product.title,
      errorType: 'missing_format',
      message: 'Missing format tag',
      tags: product.tags
    });
  } else if (formatTags.length > 1) {
    errors.push({
      handle: product.handle,
      title: product.title,
      errorType: 'multiple_formats',
      message: `Multiple format tags found: ${formatTags.join(', ')}`,
      tags: product.tags
    });
  }

  if (useTags.length === 0) {
    errors.push({
      handle: product.handle,
      title: product.title,
      errorType: 'missing_use',
      message: 'Missing use tag',
      tags: product.tags
    });
  }

  return errors;
}

/**
 * Run the tag audit and produce a summary
 */
export function runTagAudit(): TagAuditSummary {
  // Load spec
  const spec = loadParsedTaggingSpec();

  // Load products
  const products = loadProductData();

  // Initialize counters
  const pillarCounts: Record<string, number> = {};
  const familyCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};
  const allErrors: TagAuditError[] = [];

  // Validate each product
  for (const product of products) {
    const errors = validateProductTags(product, spec);
    allErrors.push(...errors);

    // Count tags
    for (const tag of product.tags) {
      const parsed = parseTag(tag);
      if (!parsed) continue;

      const { dimension, value } = parsed;

      switch (dimension) {
        case 'pillar':
          pillarCounts[value] = (pillarCounts[value] || 0) + 1;
          break;
        case 'family':
          familyCounts[value] = (familyCounts[value] || 0) + 1;
          break;
        case 'brand':
          brandCounts[value] = (brandCounts[value] || 0) + 1;
          break;
      }
    }
  }

  // Count products with errors (unique handles)
  const productsWithErrors = new Set(allErrors.map(e => e.handle));

  return {
    totalProducts: products.length,
    validProducts: products.length - productsWithErrors.size,
    errorCount: allErrors.length,
    pillarCounts,
    familyCounts,
    brandCounts,
    errors: allErrors
  };
}

/**
 * Estimate product counts per collection based on tags
 */
export function estimateCollectionCounts(
  collectionConfig: Array<{ handle: string; smart_rules?: { conditions: Array<{ value: string }> } }>
): Map<string, number> {
  const products = loadProductData();
  const counts = new Map<string, number>();

  for (const collection of collectionConfig) {
    if (!collection.smart_rules) {
      counts.set(collection.handle, 0);
      continue;
    }

    // Get all tag values from conditions
    const targetTags = collection.smart_rules.conditions
      .filter(c => c.value.includes(':'))
      .map(c => c.value);

    // Count products that match any of the target tags
    let count = 0;
    for (const product of products) {
      const hasMatch = targetTags.some(tag => product.tags.includes(tag));
      if (hasMatch) {
        count++;
      }
    }

    counts.set(collection.handle, count);
  }

  return counts;
}

/**
 * Format the audit summary as a human-readable report
 */
export function formatAuditReport(summary: TagAuditSummary): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('TAG AUDIT REPORT - What You Need Products');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push('SUMMARY');
  lines.push('-'.repeat(40));
  lines.push(`Total Products: ${summary.totalProducts}`);
  lines.push(`Valid Products: ${summary.validProducts}`);
  lines.push(`Products with Errors: ${summary.totalProducts - summary.validProducts}`);
  lines.push(`Total Errors: ${summary.errorCount}`);
  lines.push('');

  lines.push('PILLAR DISTRIBUTION');
  lines.push('-'.repeat(40));
  const sortedPillars = Object.entries(summary.pillarCounts).sort((a, b) => b[1] - a[1]);
  for (const [pillar, count] of sortedPillars) {
    lines.push(`  ${pillar}: ${count}`);
  }
  lines.push('');

  lines.push('FAMILY DISTRIBUTION (Top 20)');
  lines.push('-'.repeat(40));
  const sortedFamilies = Object.entries(summary.familyCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [family, count] of sortedFamilies) {
    lines.push(`  ${family}: ${count}`);
  }
  lines.push('');

  if (Object.keys(summary.brandCounts).length > 0) {
    lines.push('BRAND DISTRIBUTION');
    lines.push('-'.repeat(40));
    const sortedBrands = Object.entries(summary.brandCounts).sort((a, b) => b[1] - a[1]);
    for (const [brand, count] of sortedBrands) {
      lines.push(`  ${brand}: ${count}`);
    }
    lines.push('');
  }

  if (summary.errors.length > 0) {
    lines.push('ERRORS (First 50)');
    lines.push('-'.repeat(40));

    // Group errors by type
    const errorsByType: Record<string, TagAuditError[]> = {};
    for (const error of summary.errors) {
      if (!errorsByType[error.errorType]) {
        errorsByType[error.errorType] = [];
      }
      errorsByType[error.errorType].push(error);
    }

    let errorCount = 0;
    for (const [errorType, errors] of Object.entries(errorsByType)) {
      lines.push(`\n  ${errorType} (${errors.length} occurrences):`);
      for (const error of errors.slice(0, 10)) {
        if (errorCount >= 50) break;
        lines.push(`    - ${error.handle}: ${error.message}`);
        errorCount++;
      }
      if (errors.length > 10) {
        lines.push(`    ... and ${errors.length - 10} more`);
      }
    }
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}
