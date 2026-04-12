# When restarting the service, the settings were lost. Meilisearch rejects any search query trying to filter by that field.
# After re-create your index, send a PATCH request to the settings endpoint.

curl \
  -X PATCH 'https://your-meilisearch-domain.com/indexes/openlist/settings' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  --data-binary '{
    "filterableAttributes": [
      "parent_path_hashes"
    ]
  }'
