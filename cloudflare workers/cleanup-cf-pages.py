import requests
import time

ACCOUNT_ID = "your-account-id"
PROJECT_NAME = "your-project-name"
API_TOKEN = "your-api-token"

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT_NAME}/deployments"
headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# Rate limit: 1200 requests / 300 seconds = 4 requests per second max
MAX_REQUESTS_PER_SECOND = 4
DELAY_BETWEEN_REQUESTS = 1 / MAX_REQUESTS_PER_SECOND  # 0.25 seconds

# Fetch all deployments
all_deployments = []
page = 1

while True:
    response = requests.get(url, headers=headers, params={"page": page})  # Removed `per_page`
    data = response.json()

    if not data.get("success"):
        print(f"API request failed: {data.get('errors', 'Unknown error')}")
        break

    all_deployments.extend(data["result"])
    result_info = data["result_info"]
    
    # Stop if the current page has fewer results than the default page size (assumed)
    if len(data["result"]) == 0 or page >= result_info["total_pages"]:  # Use `total_pages` if available
        break
    page += 1
    time.sleep(DELAY_BETWEEN_REQUESTS)  # Rate limit delay

# Process deployments (rest of the code remains the same)
if len(all_deployments) <= 1:
    print("Only one or no deployments exist. Nothing to delete.")
else:
    all_deployments.sort(key=lambda x: x["created_on"], reverse=True)
    latest_deployment = all_deployments[0]["id"]
    print(f"Keeping latest deployment: {latest_deployment}")

    for deployment in all_deployments[1:]:
        deployment_id = deployment["id"]
        delete_url = f"{url}/{deployment_id}"
        delete_response = requests.delete(delete_url, headers=headers)
        if delete_response.status_code == 200:
            print(f"Deleted deployment: {deployment_id}")
        else:
            print(f"Failed to delete {deployment_id}: {delete_response.status_code}")
        time.sleep(DELAY_BETWEEN_REQUESTS)
