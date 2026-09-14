# Kollectozam Kollectables

Public availability catalogue for Kollectozam claim sales. Cloudflare Pages serves the contents of `frontend/`.

## Add an available item

1. Add the product photograph under `frontend/assets/img/products/`.
2. Add one object to `frontend/data/products.json` using the structure below.
3. Commit and push the change to `main`. Cloudflare Pages will publish it automatically.

```json
{
  "reference": "KZ-001",
  "name": "Product name",
  "category": "Pokemon",
  "set": "Set name",
  "language": "English",
  "condition": "Near Mint",
  "price": 45,
  "image": "assets/img/products/kz-001.jpg",
  "imageAlt": "Front photograph of Product name",
  "status": "available"
}
```

Only items with `"status": "available"` appear publicly. Change the status to `"claimed"` to remove an item while retaining its record.

Use sequential references such as `KZ-001`, `KZ-002`, and `KZ-003`. Never reuse a reference for another item.

Use clear photographs of the actual item, preferably cropped to 4:3. Keep each JPG or WebP below 1 MB where practical. Never commit customer information, payment details, access tokens or private claim records.
