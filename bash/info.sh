curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ID/access/users" \
     -H "X-Auth-Email: $CF_AC" \
     -H "X-Auth-Key: $CF_TOKEN" \
     -H "Content-Type: application/json"
