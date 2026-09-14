# Kollectozam Kollectables

Public availability catalogue for Kollectozam claim sales. Cloudflare Pages serves the contents of `frontend/`.

## Inventory administration

The production catalogue reads from `/api/products`. The private admin page at `/admin/` manages products in Cloudflare D1 and uploads photographs to R2. Cloudflare Access must protect both `/admin/*` and `/api/admin/*`; server writes also require the verified Access email header.

Required Cloudflare bindings:

- D1 database binding: `DB`
- R2 bucket binding: `PRODUCT_IMAGES`
- Optional environment variable: `ADMIN_EMAILS` (comma-separated approved email addresses)

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
