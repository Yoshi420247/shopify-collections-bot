/**
 * Tagging Spec Loader
 * Parses the tagging strategy markdown file and extracts the YAML specification
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { TaggingSpec, ParsedTaggingSpec } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

/**
 * Find the tagging spec file in the docs directory
 */
function findTaggingSpecFile(): string {
  const docsDir = join(PROJECT_ROOT, 'docs');
  const files = readdirSync(docsDir);

  const specFile = files.find(f =>
    f.toLowerCase().includes('tagging strategy') &&
    f.endsWith('.md')
  );

  if (!specFile) {
    throw new Error(
      'Could not find tagging spec file. Expected a file containing "Tagging Strategy" in docs/ directory.'
    );
  }

  return join(docsDir, specFile);
}

/**
 * Extract YAML content from markdown file
 * The YAML starts at "what_you_need_tagging_spec:" and continues to the end
 */
function extractYamlFromMarkdown(content: string): string {
  // Look for the YAML block starting with what_you_need_tagging_spec
  // The file uses escaped underscores in markdown, so we need to handle various formats:
  // - what_you_need_tagging_spec: (plain)
  // - what\_you\_need\_tagging\_spec: (single backslash escape)
  // - what\\_you\\_need\\_tagging\\_spec: (double backslash in file)
  // - what\\\_you\\\_need\\\_tagging\\\_spec: (triple backslash from markdown export)
  const patterns = [
    /what_you_need_tagging_spec:/,
    /what\\_you\\_need\\_tagging\\_spec:/,
    /what\\\\\_you\\\\\_need\\\\\_tagging\\\\\_spec:/,
    /what\\\\\\\_you\\\\\\\_need\\\\\\\_tagging\\\\\\\_spec:/
  ];

  let startIndex = -1;
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      startIndex = match.index;
      break;
    }
  }

  if (startIndex === -1) {
    throw new Error('Could not find "what_you_need_tagging_spec:" in the tagging spec file');
  }

  // Extract from the start to the end of the file
  let yamlContent = content.slice(startIndex);

  // Clean up markdown escape characters - handle multiple backslash variations
  yamlContent = yamlContent
    .replace(/\\\\\\_/g, '_')  // Triple backslash-underscore -> underscore
    .replace(/\\\\_/g, '_')    // Double backslash-underscore -> underscore
    .replace(/\\_/g, '_')      // Single backslash-underscore -> underscore
    .replace(/\\</g, '<')      // Unescape angle brackets
    .replace(/\\>/g, '>')
    .replace(/\\-/g, '-')      // Unescape hyphens
    .replace(/\\\./g, '.')     // Unescape dots
    .replace(/\\\*/g, '*');    // Unescape asterisks

  return yamlContent;
}

/**
 * Load and parse the raw tagging spec YAML
 */
export function loadRawTaggingSpec(): TaggingSpec {
  const specPath = findTaggingSpecFile();
  const content = readFileSync(specPath, 'utf-8');
  const yamlContent = extractYamlFromMarkdown(content);

  try {
    const parsed = yaml.load(yamlContent) as { what_you_need_tagging_spec: TaggingSpec };
    return parsed.what_you_need_tagging_spec;
  } catch (error) {
    throw new Error(`Failed to parse tagging spec YAML: ${error}`);
  }
}

/**
 * Parse the tag_dimensions section to extract allowed values
 */
function parseTagDimensions(dimensionsText: string): Partial<ParsedTaggingSpec> {
  const result: Partial<ParsedTaggingSpec> = {
    allowedDimensions: [],
    allowedPillars: [],
    allowedFamilies: [],
    allowedBrands: [],
    allowedMaterials: [],
    allowedFormats: [],
    allowedUses: [],
    allowedStyles: []
  };

  // Known dimensions from the spec (includes 'category' for Oil Slick products)
  result.allowedDimensions = [
    'pillar', 'family', 'brand', 'material', 'format', 'use',
    'joint_size', 'joint_angle', 'joint_gender', 'length', 'capacity', 'style', 'bundle',
    'category'  // Oil Slick extraction/packaging products use category:xxx tags
  ];

  // Extract pillar values
  const pillarMatches = dimensionsText.match(/pillar:([\w-]+)/g);
  if (pillarMatches) {
    result.allowedPillars = pillarMatches.map(m => m.replace('pillar:', ''));
  }

  // Extract family values
  const familyMatches = dimensionsText.match(/family:([\w-]+)/g);
  if (familyMatches) {
    result.allowedFamilies = [...new Set(familyMatches.map(m => m.replace('family:', '')))];
  }

  // Extract brand values
  const brandMatches = dimensionsText.match(/brand:([\w-]+)/g);
  if (brandMatches) {
    result.allowedBrands = [...new Set(brandMatches.map(m => m.replace('brand:', '')))];
  }

  // Extract material values
  const materialMatches = dimensionsText.match(/material:([\w-]+)/g);
  if (materialMatches) {
    result.allowedMaterials = [...new Set(materialMatches.map(m => m.replace('material:', '')))];
  }

  // Extract format values
  const formatMatches = dimensionsText.match(/format:([\w-]+)/g);
  if (formatMatches) {
    result.allowedFormats = [...new Set(formatMatches.map(m => m.replace('format:', '')))];
  }

  // Extract use values
  const useMatches = dimensionsText.match(/use:([\w-]+)/g);
  if (useMatches) {
    result.allowedUses = [...new Set(useMatches.map(m => m.replace('use:', '')))];
  }

  // Extract style values
  const styleMatches = dimensionsText.match(/style:([\w-]+)/g);
  if (styleMatches) {
    result.allowedStyles = [...new Set(styleMatches.map(m => m.replace('style:', '')))];
  }

  return result;
}

/**
 * Load and parse the tagging spec into a structured format for validation
 */
export function loadParsedTaggingSpec(): ParsedTaggingSpec {
  const rawSpec = loadRawTaggingSpec();

  // Parse the tag_dimensions section
  const dimensions = parseTagDimensions(rawSpec.tag_dimensions);

  // Also parse the product_family_rules for additional extraction
  const familyRules = parseTagDimensions(rawSpec.product_family_rules);

  // Merge and deduplicate
  const merged: ParsedTaggingSpec = {
    allowedDimensions: dimensions.allowedDimensions || [],
    allowedPillars: [...new Set([...(dimensions.allowedPillars || []), ...(familyRules.allowedPillars || [])])],
    allowedFamilies: [...new Set([...(dimensions.allowedFamilies || []), ...(familyRules.allowedFamilies || [])])],
    allowedBrands: [...new Set([...(dimensions.allowedBrands || []), ...(familyRules.allowedBrands || [])])],
    allowedMaterials: [...new Set([...(dimensions.allowedMaterials || []), ...(familyRules.allowedMaterials || [])])],
    allowedFormats: [...new Set([...(dimensions.allowedFormats || []), ...(familyRules.allowedFormats || [])])],
    allowedUses: [...new Set([...(dimensions.allowedUses || []), ...(familyRules.allowedUses || [])])],
    allowedStyles: [...new Set([...(dimensions.allowedStyles || []), ...(familyRules.allowedStyles || [])])]
  };

  // Ensure we have the known values from the spec as fallback
  if (merged.allowedPillars.length === 0) {
    merged.allowedPillars = ['smokeshop-device', 'accessory', 'packaging', 'merch'];
  }

  if (merged.allowedFamilies.length === 0) {
    merged.allowedFamilies = [
      'glass-bong', 'silicone-bong', 'glass-rig', 'silicone-rig', 'bubbler', 'joint-bubbler',
      'spoon-pipe', 'chillum-onehitter', 'nectar-collector', 'flower-bowl', 'carb-cap', 'banger',
      'dab-tool', 'grinder', 'rolling-paper', 'tray', 'torch', 'ash-catcher', 'downstem',
      'rolling-accessory', 'storage-accessory', 'vape-battery', 'vape-coil',
      'electronic-nectar-collector', 'merch-pendant'
    ];
  }

  if (merged.allowedBrands.length === 0) {
    merged.allowedBrands = [
      'raw', 'zig-zag', 'vibes', 'elements', 'cookies', 'lookah', 'puffco', 'maven',
      'g-pen', 'only-quartz', 'eo-vape', 'monark', '710-sci', 'peaselburg', 'scorch'
    ];
  }

  if (merged.allowedMaterials.length === 0) {
    merged.allowedMaterials = [
      'glass', 'borosilicate', 'quartz', 'silicone', 'metal', 'stainless-steel',
      'titanium', 'ceramic', 'wood', 'stone', 'acrylic', 'plastic', 'hybrid'
    ];
  }

  if (merged.allowedFormats.length === 0) {
    merged.allowedFormats = [
      'bong', 'rig', 'pipe', 'bubbler', 'nectar-collector', 'banger', 'cap', 'tool',
      'grinder', 'torch', 'paper', 'tray', 'jar', 'box', 'coil', 'battery-mod', 'accessory', 'pendant'
    ];
  }

  if (merged.allowedUses.length === 0) {
    merged.allowedUses = [
      'flower-smoking', 'dabbing', 'multi-use', 'rolling', 'setup-protection', 'storage', 'preparation'
    ];
  }

  if (merged.allowedStyles.length === 0) {
    merged.allowedStyles = [
      'made-in-usa', 'heady', 'animal', 'brand-highlight', 'travel-friendly', 'discreet-profile'
    ];
  }

  return merged;
}

/**
 * Validate a single tag against the spec
 */
export function validateTag(tag: string, spec: ParsedTaggingSpec): { valid: boolean; error?: string } {
  // Check if tag has dimension:value format
  if (!tag.includes(':')) {
    return { valid: false, error: `Tag "${tag}" is not in dimension:value format` };
  }

  const [dimension, value] = tag.split(':');

  // Check if dimension is known
  if (!spec.allowedDimensions.includes(dimension)) {
    return { valid: false, error: `Unknown dimension "${dimension}" in tag "${tag}"` };
  }

  // For dimensions with enumerated values, check if value is valid
  switch (dimension) {
    case 'pillar':
      if (!spec.allowedPillars.includes(value)) {
        return { valid: false, error: `Unknown pillar value "${value}"` };
      }
      break;
    case 'family':
      if (!spec.allowedFamilies.includes(value)) {
        return { valid: false, error: `Unknown family value "${value}"` };
      }
      break;
    case 'brand':
      // Brands can be extended, so we only warn if not in known list
      // but still consider valid
      break;
    case 'material':
      if (!spec.allowedMaterials.includes(value)) {
        return { valid: false, error: `Unknown material value "${value}"` };
      }
      break;
    case 'format':
      if (!spec.allowedFormats.includes(value)) {
        return { valid: false, error: `Unknown format value "${value}"` };
      }
      break;
    case 'use':
      if (!spec.allowedUses.includes(value)) {
        return { valid: false, error: `Unknown use value "${value}"` };
      }
      break;
    case 'style':
      if (!spec.allowedStyles.includes(value)) {
        return { valid: false, error: `Unknown style value "${value}"` };
      }
      break;
    // joint_size, joint_angle, joint_gender, length, capacity, bundle have open-ended values
  }

  return { valid: true };
}
