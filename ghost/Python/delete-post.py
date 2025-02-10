import requests
import jwt
from datetime import datetime

# Ghost API credentials
GHOST_API_URL = "https://localhost:2368/ghost/api/admin/"
ADMIN_API_KEY = ""  # Replace with your actual Admin API key
TAG_SLUG = ""  # Replace with the tag slug you want to filter by
TITLE_KEYWORD = ""  # Replace with the keyword you want to search in the title

# Function to generate JWT token
def generate_ghost_token(api_key):
    id, secret = api_key.split(':')
    iat = int(datetime.now().timestamp())
    header = {'alg': 'HS256', 'typ': 'JWT', 'kid': id}
    payload = {
        'iat': iat,
        'exp': iat + 5 * 60,  # Token expires in 5 minutes
        'aud': '/admin/'
    }
    token = jwt.encode(payload, bytes.fromhex(secret), algorithm='HS256', headers=header)
    return token

# Function to fetch posts filtered by tag (with pagination support)
def fetch_posts_by_tag(token, tag_slug):
    url = f"{GHOST_API_URL}posts/"
    headers = {
        "Authorization": f"Ghost {token}",
        "Content-Type": "application/json"
    }
    all_posts = []
    page = 1
    while True:
        params = {
            "page": page,
            "limit": 15,  # Ghost API default limit
            "filter": f"tag:{tag_slug}"  # Filter posts by tag
        }
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            posts = response.json()["posts"]
            if not posts:  # No more posts to fetch
                break
            all_posts.extend(posts)
            page += 1
        else:
            print(f"Failed to fetch posts. Status code: {response.status_code}, Response: {response.text}")
            break
    return all_posts

# Function to delete a post by its ID
def delete_post(post_id, post_title, token):
    url = f"{GHOST_API_URL}posts/{post_id}/"
    headers = {
        "Authorization": f"Ghost {token}",
        "Content-Type": "application/json"
    }
    response = requests.delete(url, headers=headers)
    if response.status_code == 204:  # 204 No Content indicates successful deletion
        print(f"Post '{post_title}' deleted successfully.")
    else:
        print(f"Failed to delete post '{post_title}'. Status code: {response.status_code}, Response: {response.text}")

# Main function to delete posts
def main():
    # Generate the JWT token
    token = generate_ghost_token(ADMIN_API_KEY)
    
    # Fetch posts filtered by tag
    posts = fetch_posts_by_tag(token, TAG_SLUG)
    print(f"Total posts fetched with tag '{TAG_SLUG}': {len(posts)}")
    
    # Filter posts with title containing the keyword
    target_posts = [
        post for post in posts 
        if TITLE_KEYWORD.lower() in post["title"].lower()
    ]
    
    print(f"Posts with tag '{TAG_SLUG}' and title containing '{TITLE_KEYWORD}': {len(target_posts)}")
    
    if not target_posts:
        print(f"No posts with tag '{TAG_SLUG}' and title containing '{TITLE_KEYWORD}' found.")
        return
    
    # Delete each target post
    for post in target_posts:
        delete_post(post["id"], post["title"], token)

if __name__ == "__main__":
    main()
