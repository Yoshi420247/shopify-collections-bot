# Shopify Collections & Menus Automation

A code-driven system that keeps Shopify **smart collections** and **navigation menus** in sync with YAML configuration files.

## Overview

This toolkit supports multiple store configurations:
- **What You Need (WYN)** - Smokeshop products (bongs, rigs, pipes, accessories)
- **Oil Slick** - Extraction supplies, packaging, and headshop products

### Key Features:

1. **Tag Audit CLI** - Validates product tags in CSV against the tagging spec
2. **Collections Sync CLI** - Creates/updates Shopify smart collections based on YAML config
3. **Menus Sync CLI** - Creates/updates Shopify navigation menus based on YAML config
4. **SEO-Safe Sync CLI** - Unified sync with automatic URL redirect preservation

All operations are **safe by default** (dry-run mode). You must explicitly pass `--apply` to make changes.

## Quick Start

### Prerequisites

- Node.js 20+
- A Shopify store with Admin API access
- The WYN product export CSV with new-format tags

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Shopify credentials
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_STORE_DOMAIN` | Yes | Your store domain (e.g., `mystore.myshopify.com`) |
| `SHOPIFY_ADMIN_API_TOKEN` | Yes | Admin API access token |
| `SHOPIFY_API_VERSION` | No | API version (default: `2025-01`) |
| `SHOPIFY_ONLINE_STORE_PUBLICATION_ID` | No | Publication ID (fetched dynamically if not set) |
| `CONFIG_NAME` | No | Default config to use: `wyn` or `oilslick` (default: `wyn`) |

### Getting an Admin API Token

1. Go to your Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps" → "Create an app"
3. Configure the app with these scopes:
   - `read_products`, `write_products`
   - `read_collections`, `write_collections`
   - `read_online_store_navigation`, `write_online_store_navigation`
   - `read_publications`, `write_publications`
4. Install the app and copy the Admin API access token

## Usage

### Choosing a Configuration

All CLI commands support the `--config` flag to choose which configuration to use:

```bash
# Use What You Need config (default)
npm run wyn:sync-collections

# Use Oil Slick config
npm run wyn:sync-collections -- --config oilslick
```

Available configs:
- `wyn` - What You Need smokeshop products (default)
- `oilslick` - Oil Slick extraction supplies + headshop products

### 1. Validate Tags

Check that product tags in the CSV follow the tagging spec:

```bash
# Run tag audit
npm run wyn:tag-audit

# Save full report to JSON
npm run wyn:tag-audit -- -o audit-report.json
```

### 2. Sync Collections

Preview and apply collection changes to Shopify:

```bash
# Preview changes (dry run)
npm run wyn:sync-collections

# Apply changes to Shopify
npm run wyn:sync-collections -- --apply

# Apply and publish new collections to Online Store
npm run wyn:sync-collections -- --apply --publish

# Compare expected vs actual product counts
npm run wyn:sync-collections -- --compare-counts

# Validate config only (no API calls)
npm run wyn:sync-collections -- --skip-api

# Use Oil Slick config
npm run wyn:sync-collections -- --config oilslick --apply
```

### 3. Sync Menus

Preview and apply menu changes to Shopify:

```bash
# Preview changes (dry run)
npm run wyn:sync-menus

# Apply changes to Shopify
npm run wyn:sync-menus -- --apply

# Compare existing vs desired menu structure
npm run wyn:sync-menus -- --compare

# Validate config only (no API calls)
npm run wyn:sync-menus -- --skip-api

# Use Oil Slick config with SEO-safe sync
npm run wyn:sync-menus -- --config oilslick --apply --seo-safe
```

### 4. SEO-Safe Sync (Recommended)

The unified SEO-safe sync handles both collections and menus with automatic URL redirect preservation:

```bash
# Preview all changes
npm run wyn:seo-safe-sync

# Apply all changes with redirects
npm run wyn:seo-safe-sync -- --apply

# Oil Slick: Apply with publishing
npm run wyn:seo-safe-sync -- --config oilslick --apply --publish
```

### Complete Workflow for Oil Slick

```bash
# 1. Preview collection changes
npm run wyn:sync-collections -- --config oilslick

# 2. Apply collection changes
npm run wyn:sync-collections -- --config oilslick --apply --publish

# 3. Preview menu changes
npm run wyn:sync-menus -- --config oilslick

# 4. Apply menu changes with SEO preservation
npm run wyn:sync-menus -- --config oilslick --apply --seo-safe
```

## Configuration Files

### Available Configurations

| Config | Collections File | Menus File | Description |
|--------|-----------------|------------|-------------|
| `wyn` | `wyn_collections.yml` | `wyn_menus.yml` | What You Need smokeshop products |
| `oilslick` | `oilslick_collections.yml` | `oilslick_menus.yml` | Oil Slick extraction + headshop |

### `config/wyn_collections.yml`

**Single source of truth** for all What You Need collections.

Each collection defines:
- `key`: Unique identifier
- `title`: Display name in Shopify
- `handle`: URL slug
- `group`: Category (devices, accessories, brands, themes, merch, misc)
- `smart_rules`: Tag conditions for smart collection

Example:

```yaml
collections:
  - key: bongs
    title: "Bongs"
    handle: "bongs"
    group: "devices"
    type: "SMART"
    sort_order: "BEST_SELLING"
    smart_rules:
      appliedDisjunctively: true  # OR logic
      conditions:
        - field: "TAG"
          relation: "EQUALS"
          value: "family:glass-bong"
        - field: "TAG"
          relation: "EQUALS"
          value: "family:silicone-bong"
```

### `config/wyn_menus.yml`

**Single source of truth** for navigation menus.

Example:

```yaml
menus:
  - handle: "main-menu"
    title: "Main menu"
    items:
      - title: "Shop All"
        type: "COLLECTION"
        target_collection_handle: "shop-all-what-you-need"
      - title: "Glass"
        type: "COLLECTION"
        target_collection_handle: "bongs"
        children:
          - title: "Bongs"
            type: "COLLECTION"
            target_collection_handle: "bongs"
```

## Project Structure

```
├── config/
│   ├── wyn_collections.yml       # What You Need collection definitions
│   ├── wyn_menus.yml             # What You Need menu structure
│   ├── oilslick_collections.yml  # Oil Slick collection definitions
│   └── oilslick_menus.yml        # Oil Slick menu structure
├── data/
│   └── WYN_PRODUCT_EXPORT_TAGGED.csv
├── docs/
│   ├── Tagging Strategy for What you need products Shopify.md
│   └── Menu Collections WYN strat guide.md
├── src/
│   ├── cli/                   # CLI entry points
│   ├── config/                # Config loaders
│   ├── shopify/               # Shopify API helpers
│   └── wyn/                   # Business logic
│       ├── tags/              # Tag audit
│       ├── collections/       # Collections sync
│       └── menus/             # Menus sync
└── tests/
```

## Adding New Collections or Brands

### Add a New Family Collection

1. Update `config/wyn_collections.yml`:

```yaml
- key: new-family
  title: "New Family"
  handle: "new-family"
  group: "accessories"
  type: "SMART"
  smart_rules:
    appliedDisjunctively: true
    conditions:
      - field: "TAG"
        relation: "EQUALS"
        value: "family:new-family"
```

2. Run sync:
```bash
npm run wyn:sync-collections -- --apply
```

### Add a New Brand Collection

1. Update `config/wyn_collections.yml`:

```yaml
- key: new-brand
  title: "New Brand"
  handle: "new-brand"
  group: "brands"
  type: "SMART"
  smart_rules:
    appliedDisjunctively: true
    conditions:
      - field: "TAG"
        relation: "EQUALS"
        value: "brand:new-brand"
```

2. Optionally add to menu in `config/wyn_menus.yml`

3. Run sync:
```bash
npm run wyn:sync-collections -- --apply
npm run wyn:sync-menus -- --apply
```

## Theme Integration

The main menu uses handle `main-menu`. Ensure your theme's header navigation setting is configured to use this handle.

In Dawn or similar themes:
1. Go to Online Store → Themes → Customize
2. Find the Header section settings
3. Set the menu to "Main menu"

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/collectionsConfig.test.ts
```

## Guardrails

- **Dry-run by default**: No changes are made unless `--apply` is passed
- **No destructive operations**: Collections/menus not in config are left alone
- **Validation**: Config is validated before any API calls
- **Error handling**: Rich error messages for API and config issues

## Troubleshooting

### "Missing required environment variables"

Ensure `.env` file exists with valid credentials:
```bash
cp .env.example .env
# Edit .env with your values
```

### "Collection handle not found"

Run collections sync before menus sync:
```bash
npm run wyn:sync-collections -- --apply
npm run wyn:sync-menus -- --apply
```

### "Could not find Online Store publication"

Either:
1. Set `SHOPIFY_ONLINE_STORE_PUBLICATION_ID` in `.env`
2. Or ensure your store has an Online Store sales channel enabled

### Rate Limiting

The CLI automatically retries with exponential backoff on rate limit errors. If you see persistent 429 errors, wait a few minutes and retry.

## License

ISC
