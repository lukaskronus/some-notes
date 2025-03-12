import requests
import jwt
import os
from datetime import datetime
import html2text

# Ghost API credentials
GHOST_API_URL = ""
ADMIN_API_KEY = ""  # Replace with your actual Admin API key
TAG_SLUG = ""  # Replace with the tag slug you want to export

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

# Function to fetch posts filtered by tag (with pagination support) - MODIFIED TO INCLUDE AUTHORS
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
            "limit": 15,
            "filter": f"tag:{tag_slug}",
            "formats": "html",
            "include": "tags,authors"  # ← ADDED AUTHORS TO INCLUDE
        }
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            posts = response.json()["posts"]
            if not posts:
                break
            all_posts.extend(posts)
            page += 1
        else:
            print(f"Failed to fetch posts. Status code: {response.status_code}, Response: {response.text}")
            break
    return all_posts

def save_post_to_markdown(post, output_dir="output"):
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Generate filename using published date and slug
    published_at = post.get('published_at', '')
    if published_at:
        try:
            date_obj = datetime.strptime(published_at, "%Y-%m-%dT%H:%M:%S.%fZ")
            date_str = date_obj.strftime("%Y-%m-%d")
        except ValueError:
            date_str = "no-date"
    else:
        date_str = "no-date"
    
    slug = post['slug']
    filename = f"{slug}.md"
    filepath = os.path.join(output_dir, filename)
    
    # Get HTML content - some posts might use mobiledoc instead
    html_content = post.get('html', '')
    
    # Fallback to mobiledoc if HTML is empty (requires mobiledoc parser)
    if not html_content and post.get('mobiledoc'):
        print(f"Post '{post['title']}' uses mobiledoc format, consider adding mobiledoc conversion")
        html_content = "[[Content in mobiledoc format - conversion not implemented]]"
    
    # Convert HTML to Markdown
    converter = html2text.HTML2Text()
    converter.body_width = 0
    markdown_content = converter.handle(html_content)
    
 # MODIFIED FRONT MATTER GENERATION
    front_matter_lines = [
        f'title: "{post["title"]}"',
        f'date: {published_at}',
        f'slug: {slug}',
        f'tags: {[tag["name"] for tag in post.get("tags", [])]}',
        f'authors: {[author["name"] for author in post.get("authors", [])]}'
    ]
    
    # Conditionally add feature_image
    if feature_image := post.get('feature_image'):
        front_matter_lines.append(f'feature_image: "{feature_image}"')
    
    # Combine front matter lines
    front_matter = '---\n' + '\n'.join(front_matter_lines) + '\n---\n'
# status: {post.get('status', 'unknown')}

    # Combine front matter and content
    full_content = front_matter + markdown_content
    
    # Write to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(full_content)
    
    print(f"Saved post '{post['title']}' to {filepath}")

# Main function to export posts
def main():
    # Generate the JWT token
    token = generate_ghost_token(ADMIN_API_KEY)
    
    # Fetch posts filtered by tag
    posts = fetch_posts_by_tag(token, TAG_SLUG)
    print(f"Total posts found with tag '{TAG_SLUG}': {len(posts)}")
    
    if not posts:
        print(f"No posts with tag '{TAG_SLUG}' found.")
        return
    
    # Save each post to markdown
    for post in posts:
        save_post_to_markdown(post)

if __name__ == "__main__":
    main()
