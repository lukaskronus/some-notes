curl \
  -X POST 'https://your-meilisearch-domain.com/indexes/openlist/settings' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  --data-binary '{
    "filterableAttributes": [
      "parent_path_hashes"
    ]
  }'
