import requests  # pip install requests
import jwt  # pip install pyjwt
from datetime import datetime as date

# Replace these with your Ghost blog details
GHOST_URL = "https://localhost:2368"  # Your Ghost blog URL
ADMIN_API_KEY = ""  # Your Ghost Admin API key
TAG_SLUG = ""  # The slug of the tag you want to filter by
KEYWORD = ""  # The keyword to search for in the post title

# New code injection to add
NEW_CODE_INJECTION = """

"""

# Function to generate a JWT token from the Admin API key
def generate_jwt_token(admin_api_key):
    id, secret = admin_api_key.split(':')  # Split the key into ID and SECRET
    iat = int(date.now().timestamp())

    header = {'alg': 'HS256', 'typ': 'JWT', 'kid': id}
    payload = {
        'iat': iat,
        'exp': iat + 5 * 60,  # Token expires in 5 minutes
        'aud': '/admin/'
    }

    return jwt.encode(payload, bytes.fromhex(secret), algorithm='HS256', headers=header)

# Function to fetch all posts with a specific tag
def fetch_all_posts_with_tag(ghost_url, jwt_token, tag_slug):
    all_posts = []
    page = 1
    per_page = 15

    while True:
        url = f"{ghost_url}/ghost/api/admin/posts/"
        params = {"filter": f"tag:{tag_slug}", "page": page, "limit": per_page}
        headers = {"Authorization": f"Ghost {jwt_token}"}

        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            all_posts.extend(data.get('posts', []))

            # Check if more pages exist
            meta = data.get('meta', {}).get('pagination', {})
            if page >= meta.get('pages', 0):
                break
            page += 1
        else:
            print(f"Failed to fetch posts. Status code: {response.status_code}, Response: {response.text}")
            break

    return all_posts

# Function to update code injection for a post
def update_code_injection(ghost_url, jwt_token, post, code_injection):
    post_id = post.get('id')
    post_title = post.get('title', 'Untitled')  # Get the post title or default to 'Untitled'
    updated_at = post.get('updated_at')  # Required for validation

    if not post_id or not updated_at:
        return

    url = f"{ghost_url}/ghost/api/admin/posts/{post_id}/"
    data = {"posts": [{"codeinjection_head": code_injection, "updated_at": updated_at}]}
    headers = {"Authorization": f"Ghost {jwt_token}"}

    response = requests.put(url, json=data, headers=headers)

    if response.status_code == 200:
        print(f"✅ Updated code injection for post: '{post_title}'")
    else:
        print(f"❌ Failed to update post: '{post_title}'. Status code: {response.status_code}")
        print(f"Response: {response.text}")

# Generate the JWT token
jwt_token = generate_jwt_token(ADMIN_API_KEY)

# Fetch all posts with the specified tag
posts = fetch_all_posts_with_tag(GHOST_URL, jwt_token, TAG_SLUG)

if posts:
    print(f"Found {len(posts)} posts with tag '{TAG_SLUG}'.")

    # Filter posts by keyword in title
    matching_posts = [post for post in posts if KEYWORD.lower() in post.get('title', '').lower()]

    if matching_posts:
        print(f"Found {len(matching_posts)} posts with tag '{TAG_SLUG}' and keyword '{KEYWORD}' in the title. Updating code injection...")
        for post in matching_posts:
            update_code_injection(GHOST_URL, jwt_token, post, NEW_CODE_INJECTION)
        print("🎉 Code injection update completed!")
    else:
        print(f"⚠️ No posts found with tag '{TAG_SLUG}' and keyword '{KEYWORD}' in the title.")
else:
    print(f"⚠️ No posts found with tag '{TAG_SLUG}'.")
