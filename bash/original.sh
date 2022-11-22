# https://firebog.net/
urlList=(
    "https://adaway.org/hosts.txt"
#     "https://v.firebog.net/hosts/AdguardDNS.txt"
#     "https://v.firebog.net/hosts/Admiral.txt"
    "https://raw.githubusercontent.com/anudeepND/blacklist/master/adservers.txt"
    "https://s3.amazonaws.com/lists.disconnect.me/simple_ad.txt"
    "https://v.firebog.net/hosts/Easylist.txt"
    "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext"
    "https://raw.githubusercontent.com/FadeMind/hosts.extras/master/UncheckyAds/hosts"
    "https://raw.githubusercontent.com/bigdargon/hostsVN/master/hosts"
    "https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt"
    "https://s3.amazonaws.com/lists.disconnect.me/simple_malvertising.txt"
    "https://v.firebog.net/hosts/Prigent-Crypto.txt"
    "https://raw.githubusercontent.com/FadeMind/hosts.extras/master/add.Risk/hosts"
    "https://bitbucket.org/ethanr/dns-blacklists/raw/8575c9f96e5b4a1308f2f12394abd86d0927a4a0/bad_lists/Mandiant_APT1_Report_Appendix_D.txt"
    "https://phishing.army/download/phishing_army_blocklist_extended.txt"
    "https://malware-filter.gitlab.io/malware-filter/phishing-filter-hosts.txt"
    "https://gitlab.com/quidsup/notrack-blocklists/raw/master/notrack-malware.txt"
    "https://raw.githubusercontent.com/Spam404/lists/master/main-blacklist.txt"
    "https://raw.githubusercontent.com/AssoEchap/stalkerware-indicators/master/generated/hosts"
)

urlListAdBlock=(
    # "https://raw.githubusercontent.com/easylist/easylistchina/master/easylistchina.txt"
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
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/fa50027d-b63b-4847-a8f0-981e69c6f249" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "fa50027d-b63b-4847-a8f0-981e69c6f249","name": "Block Ads and Malicious","description": "","precedence": 10000,"enabled": true,"action": "block","filters": ["dns"],"created_at": "2022-08-24T06:55:54Z","updated_at": "2022-08-25T06:19:46Z","deleted_at": null,"traffic": "dns.fqdn == \"hohoho.ho\"","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": true,"block_reason": "","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {  "dp": false,  "dcp": false,  "dd": false,  "du": false,  "dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}    }'

# de-active ruleH
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/ac45ab78-28cb-49b6-a5fb-f08e773ba21f" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "ac45ab78-28cb-49b6-a5fb-f08e773ba21f","name": "Block Ads and Malicious HTTP","description": "","precedence": 12000,"enabled": true,"action": "block","filters": ["http"],"created_at": "2022-08-25T09:01:27Z","updated_at": "2022-08-25T09:01:27Z","deleted_at": null,"traffic": "any(http.request.domains[*] == \"hohoho.ho\")","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": true,"block_reason": "Cloudflare Zero Trust Blocked! by KT","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {"dp": false,"dcp": false,"dd": false,"du": false,"dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}}'

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
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/fa50027d-b63b-4847-a8f0-981e69c6f249" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "fa50027d-b63b-4847-a8f0-981e69c6f249","name": "Block Ads and Malicious","description": "","precedence": 10000,"enabled": true,"action": "block","filters": ["dns"],"created_at": "2022-08-24T06:55:54Z","updated_at": "2022-08-25T06:19:46Z","deleted_at": null,"traffic": "'"$rule"'","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": true,"block_reason": "Cloudflare Zero Trust Blocked! by KT","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {  "dp": false,  "dcp": false,  "dd": false,  "du": false,  "dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}    }'

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
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ID/gateway/rules/ac45ab78-28cb-49b6-a5fb-f08e773ba21f" \
    -H "X-Auth-Email: $CF_AC" \
    -H "Authorization: $CF_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"id": "ac45ab78-28cb-49b6-a5fb-f08e773ba21f","name": "Block Ads and Malicious HTTP","description": "","precedence": 12000,"enabled": true,"action": "block","filters": ["http"],"created_at": "2022-08-25T09:01:27Z","updated_at": "2022-08-25T09:01:27Z","deleted_at": null,"traffic": "'"$ruleH"'","identity": "","device_posture": "","version": 1,"rule_settings": {"block_page_enabled": true,"block_reason": "Cloudflare Zero Trust Blocked! by KT","override_ips": null,"override_host": "","l4override": null,"biso_admin_controls": {"dp": false,"dcp": false,"dd": false,"du": false,"dk": false},"add_headers": {},"ip_categories": false,"check_session": null,"insecure_disable_dnssec_validation": false}}'
