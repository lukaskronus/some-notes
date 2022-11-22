urlList=(
    "https://hblock.molinero.dev/hosts"
)

urlListAdBlock=(
    # "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt"
)

# download all list and to csv
touch all.csv
for url in ${urlList[@]}; do
    filename=$(basename "$url")
    wget -T 3 -t 3 -O $filename $url

    for tempFile in $filename; do
        # to csv
        sed 's/^#.*//g' "$tempFile" >"${tempFile}.tmp2"
        sed 's/127.0.0.1  localhost//g' "${tempFile}.tmp2" >"${tempFile}.tmp3"
        sed 's/::1  localhost//g' "${tempFile}.tmp3" >"${tempFile}.tmp4"
        sed '/^$/d' "${tempFile}.tmp4" >"${tempFile}.tmp5"
        sed 's/^127.0.0.1 //g' "${tempFile}.tmp5" >"${tempFile}.tmp6"
        sed 's/^0.0.0.0 //g' "${tempFile}.tmp6" >"${tempFile}.tmp7"
        sed 's/^0.0.0.0//g' "${tempFile}.tmp7" >"${tempFile}.tmp8"
        sed 's/^www.//g' "${tempFile}.tmp8" >"${tempFile}.tmp9"
        sed 's/$/,/g' "${tempFile}.tmp9" >"${tempFile}.csv"

        rm "${tempFile}.tmp"*
        cat "${tempFile}.csv" >>all.csv
        rm "${tempFile}.csv"
        # rm "$tempFile"
    done
done

# download all adblock list and to csv
for url in ${urlListAdBlock[@]}; do
    filename=$(basename "$url")
    wget -T 3 -t 3 -O $filename $url

    for tempFile in $filename; do
        startLine="$(grep -n "!----------------------------------Ads-Union----------------------------------!" $tempFile | head -n 1 | cut -d: -f1)"
        startLine=$((startLine + 1))
        endLine="$(grep -n "!------------------------------------Popups-----------------------------------!" $tempFile | head -n 1 | cut -d: -f1)"
        endLine=$((endLine - 1))

        # to csv
        sed -n ''$startLine','$endLine'p' <$tempFile >"${tempFile}.tmp2"
        sed 's/^||//g' "${tempFile}.tmp2" >"${tempFile}.tmp3"
        sed 's/\^.*$//g' "${tempFile}.tmp3" >"${tempFile}.tmp4"
        sed 's/^$//g' "${tempFile}.tmp4" >"${tempFile}.tmp5"
        sed 's/^##.*//g' "${tempFile}.tmp5" >"${tempFile}.tmp6"
        sed 's/^.*\/.*//g' "${tempFile}.tmp6" >"${tempFile}.csv"

        rm "${tempFile}.tmp"*
        cat "${tempFile}.csv" >>all.csv
        rm "${tempFile}.csv"
        # rm "$tempFile"
    done
done

# sort
sort all.csv >all-sorted.csv
# remove duplicate
uniq all-sorted.csv all-sorted-dedup.csv

# only with main domain?
#sed -E 's/^.*\.(.*\..*)/\1/g' all-sorted-dedup.csv > all-domain.csv

# my custom rule
sed -E 's/^[a-zA-Z]*[0-9]+[a-zA-Z0-9\-]*\.(.*\..*)/\1/g' all-sorted-dedup.csv >remove-number.csv
sed -E 's/^[a-zA-Z]*[0-9]+[a-zA-Z0-9\-]*\.(.*\..*)/\1/g' remove-number.csv >all-domain.csv

# sort-again
sort all-domain.csv >all-domain-sorted.csv
# remove duplicate-again
uniq all-domain-sorted.csv all-domain-sorted-dedup.csv

# split file to 1000 lines
split -l 1000 -d --additional-suffix=.csv all-domain-sorted-dedup.csv blockedUrl
mkdir -p blockedUrl
mv blockedUrl*.csv blockedUrl
# rm *.csv

curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json"

curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/lists" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json"

# de-active rule
cd blockedUrl
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/eb1d7afc-f87a-4cc4-ab4d-9df3160970d2" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "eb1d7afc-f87a-4cc4-ab4d-9df3160970d2","name": "Block Ads and Malicious","description": "","precedence": 10000,"enabled": true,"action": "block","filters": ["dns"],"created_at": "2022-08-24T06:55:54Z","updated_at": "2022-08-25T06:19:46Z","deleted_at": null,"traffic": "dns.fqdn == \"hohoho.ho\"","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": true,"block_reason": "","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {  "dp": false,  "dcp": false,  "dd": false,  "du": false,  "dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}    }'

# de-active ruleH
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/cfab1ef5-9406-4014-94bc-f8fefa9ba1f3" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "cfab1ef5-9406-4014-94bc-f8fefa9ba1f3","name": "Block Ads and Malicious HTTP","description": "","precedence": 12000,"enabled": true,"action": "block","filters": ["http"],"created_at": "2022-08-25T09:01:27Z","updated_at": "2022-08-25T09:01:27Z","deleted_at": null,"traffic": "any(http.request.domains[*] == \"hohoho.ho\")","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": true,"block_reason": "Cloudflare Zero Trust Blocked! by KT","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {"dp": false,"dcp": false,"dd": false,"du": false,"dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}}'

# get list lists
curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/lists" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" >gatewayListJson

# delete all list
jq -r -c '.result[].id' gatewayListJson | while read i; do
    curl -X DELETE "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/lists/$i" \
        -H "X-Auth-Email: $CF_AC" \
        -H "Authorization: $CF_TOKEN" \
        -H "Content-Type: application/json"
done

# add csv to cf list
for tempFile in blockedUrl*.csv; do
    # to json
    sed 's/^/{"value":"/g' "$tempFile" >"${tempFile}.tmp2"
    sed 's/,$/"},/g' "${tempFile}.tmp2" >"${tempFile}.tmp3"
    sed '$ s/,$//g' "${tempFile}.tmp3" >"${tempFile}.json"

    echo '{"name":"'"${tempFile}.json"'","type":"DOMAIN","items":[' | cat - "${tempFile}.json" >temp && mv temp "${tempFile}.json"
    echo ']}' >>"${tempFile}.json"

    curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/lists" \
        -H "X-Auth-Email: $CF_AC" \
        -H "Authorization: $CF_TOKEN" \
        -H "Content-Type: application/json" \
        --data-binary "@${tempFile}.json"

    rm "$tempFile"
    rm "${tempFile}.tmp"*
    rm "${tempFile}.json"
done

# refresh list lists
curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/lists" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" >gatewayListJson

# generate the rule
echo -n '' >rules1.json
echo -n 'dns.fqdn == \"hohoho.ho\"' | cat - rules1.json >temp && mv temp rules1.json
jq -r -c '.result[].id' gatewayListJson | while read i; do
    echo -n " and any(dns.domains[*] in $"$i")" >>rules1.json
done
sed '$ s/-//g' rules1.json >rules2.json
rule=$(head -n 1 rules2.json)

# apply rule
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/eb1d7afc-f87a-4cc4-ab4d-9df3160970d2" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "eb1d7afc-f87a-4cc4-ab4d-9df3160970d2","name": "Block Ads and Malicious","description": "","precedence": 10000,"enabled": true,"action": "block","filters": ["dns"],"created_at": "2022-08-24T06:55:54Z","updated_at": "2022-08-25T06:19:46Z","deleted_at": null,"traffic": "'"$rule"'","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": false,"block_reason": "Cloudflare Zero Trust Listing","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {  "dp": false,  "dcp": false,  "dd": false,  "du": false,  "dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}    }'

# generate the ruleH
echo -n '' >rulesH1.json
echo -n 'any(http.request.domains[*] == \"hohoho.ho\")' | cat - rulesH1.json >temp && mv temp rulesH1.json
jq -r -c '.result[].id' gatewayListJson | while read i; do
    echo -n " and any(http.request.domains[*] in $"$i")" >>rulesH1.json
done
sed '$ s/-//g' rulesH1.json >rulesH2.json
ruleH=$(head -n 1 rulesH2.json)

rm gatewayListJson
rm rules*.json

# apply rule http
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/cfab1ef5-9406-4014-94bc-f8fefa9ba1f3" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "cfab1ef5-9406-4014-94bc-f8fefa9ba1f3","name": "Block Ads and Malicious HTTP","description": "","precedence": 12000,"enabled": true,"action": "block","filters": ["http"],"created_at": "2022-08-25T09:01:27Z","updated_at": "2022-08-25T09:01:27Z","deleted_at": null,"traffic": "'"$ruleH"'","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": false,"block_reason": "Cloudflare Zero Trust Listing","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {"dp": false,"dcp": false,"dd": false,"du": false,"dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}}'
