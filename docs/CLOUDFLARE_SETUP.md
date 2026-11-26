
# Cloudflare R2 Configuration Guide

To ensure the Urban Express Business OS can successfully manage and display product assets, your R2 bucket must be configured with a proper CORS policy.

## 1. CORS Policy
Navigate to your Cloudflare Dashboard > **R2** > **Buckets** > `urban` > **Settings** > **CORS Policy**. Paste the following JSON configuration:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:9002",
      "https://urbanautoexpress.com",
      "https://www.urbanautoexpress.com",
      "https://studio-4371382043-96293.web.app",
      "https://studio-4371382043-96293.firebaseapp.com",
      "https://studio.firebase.google.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

## 2. Public Access
Ensure that **Public Access** is enabled for the bucket. You should either:
1. Connect a **Custom Domain** (e.g., `images.urbanautoexpress.com`).
2. Use the **R2.dev subdomain** provided in your bucket settings.

Update your `.env` file with the resulting `R2_PUBLIC_URL`.

## 3. Infrastructure Sync
After applying the CORS policy, the system is authorized for the following operational workflows:
- **Direct Upload**: Cashiers and Admins can upload product photography directly from the Inventory module.
- **Dynamic Resizing**: Cloudflare's CDN will handle image delivery with optimized caching.
- **Folder Hierarchy**: The system will automatically organize assets into `catalog/accessories/`, `catalog/oils/`, `catalog/cleaning/`, and `profile/`.

---
*Urban Express Engineering | Storage Infrastructure*
