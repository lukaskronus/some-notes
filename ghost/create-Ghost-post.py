import os
import requests
import jwt  # pip install pyjwt
from datetime import datetime as date
import json  # Import the json module to serialize mobiledoc

# Ghost API credentials
GHOST_API_URL = "https://localhost:2368/ghost/api/admin/"
ADMIN_API_KEY = ""  # Replace with your actual Admin API key

# Function to generate JWT token
def generate_ghost_token(api_key):
    # Split the key into ID and SECRET
    id, secret = api_key.split(':')
    
    # Prepare header and payload
    iat = int(date.now().timestamp())
    header = {'alg': 'HS256', 'typ': 'JWT', 'kid': id}
    payload = {
        'iat': iat,
        'exp': iat + 5 * 60,  # Token expires in 5 minutes
        'aud': '/admin/'
    }
    
    # Create the token (including decoding secret)
    token = jwt.encode(payload, bytes.fromhex(secret), algorithm='HS256', headers=header)
    return token

# Function to read markdown file content and strip BOM
def read_markdown_file(file_path):
    with open(file_path, 'r', encoding='utf-8-sig') as file:  # Use 'utf-8-sig' to strip BOM
        content = file.read()
        # Remove any unexpected characters (e.g., zero-width spaces)
        content = content.replace('\ufeff', '')  # Remove BOM if present
        return content

# Function to convert markdown to mobiledoc with Markdown card
def markdown_to_mobiledoc(markdown_content):
    mobiledoc = {
        "version": "0.3.1",
        "atoms": [],
        "cards": [
            ["markdown", {"markdown": markdown_content}]  # Use the Markdown card
        ],
        "markups": [],
        "sections": [
            [10, 0]  # Reference the first card (index 0)
        ]
    }
    return json.dumps(mobiledoc)  # Serialize the mobiledoc dictionary to a JSON string

# Function to create a new post via Ghost API
def create_post(post_data, token):
    url = f"{GHOST_API_URL}posts/"
    headers = {
        "Authorization": f"Ghost {token}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, json={"posts": [post_data]}, headers=headers)
    if response.status_code == 201:  # 201 Created
        print(f"Post '{post_data['title']}' created successfully.")
    else:
        print(f"Failed to create post. Status code: {response.status_code}, Response: {response.text}")

# Main function to process markdown files and create posts
def main():
    # Generate the JWT token
    token = generate_ghost_token(ADMIN_API_KEY)

    # Define the tag to be added to the new posts
    tag_name = ""  # Replace with your actual tag name

    # Define the author information (either by ID or slug)
    author_slug = ""  # Replace with the actual author's slug (e.g., username)
    # OR
    # author_id = "1234567890abcdef12345678"  # Replace with the actual author's ID

    # Define code injection for the post
    code_injection_head = """

    """

    # Iterate over each markdown file
    for i in range(1, 2): # Change according how many post you want
        file_name = f"File {i}.md" # Your markdown filename
        if not os.path.exists(file_name):
            print(f"Markdown file {file_name} not found.")
            continue
        else:
            print(f"Processing the {file_name}...")

        # Read the markdown content and strip BOM
        markdown_content = read_markdown_file(file_name)

        # Convert markdown to mobiledoc with Markdown card
        mobiledoc_content = markdown_to_mobiledoc(markdown_content)

        # Define the title for the new post
        target_title = f"Chapter {i}" #Your post's title

        # Prepare the post data
        post_data = {
            "title": target_title,
            "mobiledoc": mobiledoc_content,  # Use 'mobiledoc' field with Markdown card
            "status": "draft",  # Change status if needed (e.g., "draft")
            "tags": [{"name": tag_name}],  # Add tags to the post
            "authors": [{"slug": author_slug}],  # Specify the author by slug
            "codeinjection_head": code_injection_head,  # Inject code into the <head>
            "published_at": ""  # Set the publication date
            # "2021-03-03T00:00:00.000Z" (March 3, 2021, at 00:00 UTC)
            # "2022-12-25T08:30:00.000Z" (December 25, 2022, at 08:30 UTC)
            # "2023-10-31T23:59:59.000Z" (October 31, 2023, at 23:59:59 UTC)
        }

        # Create the post
        create_post(post_data, token)

if __name__ == "__main__":
    main()
