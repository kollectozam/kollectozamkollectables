# Kollectozam Kollectables

Public availability catalogue for Kollectozam claim sales. Cloudflare Pages serves the contents of `frontend/`.

## Inventory administration

The production catalogue reads from `/api/products`. The private admin page at `/admin/` manages products in Cloudflare D1 and uploads product photographs into the GitHub repository. No object-storage service or Cloudflare Zero Trust configuration is required.

Set `ADMIN_PASSWORD` as an encrypted production secret in **Cloudflare Pages → Settings → Variables and Secrets**. The admin signs in with this password and receives a signed, secure, HTTP-only session cookie valid for seven days. Never commit the password to GitHub or add it to `wrangler.toml`.

Required Cloudflare bindings:

- D1 database binding: `DB`
- Secret: `ADMIN_PASSWORD` (unique password with at least 16 characters)
- Secret: `GITHUB_TOKEN` (fine-grained token with Contents read/write permission for this repository only)
- Optional environment variable: `GITHUB_REPOSITORY` (defaults to `kollectozam/kollectozamkollectables`)
- Optional environment variable: `GITHUB_BRANCH` (defaults to `main`)

Apply `migrations/0001_inventory.sql` to the production D1 database before using the admin page. See the deployment guidance supplied with this release for the dashboard sequence.

## Static fallback inventory

If the API has not been configured, the public catalogue falls back to `frontend/data/products.json`. This keeps the public page operational during setup. To add an item through this temporary fallback:

1. Add the product photograph under `frontend/assets/img/products/`.
2. Update `lastUpdated`, then add one object to the `products` list in `frontend/data/products.json` using the structure below.
3. Commit and push the change. Cloudflare Pages will publish it automatically after merge.

```json
{
  "lastUpdated": "2026-09-14",
  "products": [
    {
      "reference": "KZ-001",
      "name": "Product name",
      "category": "Pokemon",
      "set": "Set name",
      "cardNumber": "001/100",
      "language": "English",
      "condition": "Near Mint",
      "notes": "Clean surface and corners.",
      "price": 45,
      "image": "assets/img/products/kz-001.jpg",
      "imageAlt": "Front photograph of Product name",
      "status": "available"
    }
  ]
}
```

Only items with `"status": "available"` appear publicly. Change the status to `"claimed"` to remove an item while retaining its record.

Use sequential references such as `KZ-001`, `KZ-002`, and `KZ-003`. Never reuse a reference for another item.

Use clear photographs of the actual item, preferably cropped to 4:3. Keep each JPG or WebP below 1 MB where practical. Never commit customer information, payment details, access tokens or private claim records.
