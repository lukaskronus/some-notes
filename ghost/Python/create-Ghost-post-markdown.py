import os
import requests
import jwt  # pip install pyjwt
from datetime import datetime, timedelta
import json  # Import the json module to serialize mobiledoc
import re  # Import regex for filename parsing

# Ghost API credentials
GHOST_API_URL = "https://localhost:2368/ghost/api/admin/"
ADMIN_API_KEY = ""  # Replace with your actual Admin API key

# Function to generate JWT token
def generate_ghost_token(api_key):
    # Split the key into ID and SECRET
    id, secret = api_key.split(':')
    
    # Prepare header and payload
    iat = int(datetime.now().timestamp())
    header = {'alg': 'HS256', 'typ': 'JWT', 'kid': id}
    payload = {
        'iat': iat,
        'exp': iat + 1 * 60,  # Token expires in 1 minutes
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

# Function to extract book and chapter numbers from filename
def extract_numbers(filename):
    match = re.match(r"^(\d+)-(\d+)\.md$", filename)
    if match:
        return int(match.group(1)), int(match.group(2))  # Return book and chapter numbers
    return None

# Main function to process markdown files and create posts
def main():
    # Generate the JWT token
    token = generate_ghost_token(ADMIN_API_KEY)

    # Define the tag to be added to the new posts
    tag_name = ""  # Replace with your actual tag name

    # Define the author information (either by ID or slug)
    author_slug = ""  # Replace with the actual author's slug (e.g., username)

    # Define the initial publication time for the first chapter
    initial_published_at = datetime(2021, 3, 12, 1, 0, 0)  # March 12, 2021 at 01:00:00

    # Define code injection for the post
    code_injection_head = """

    """

    # Get all markdown files in the current directory
    markdown_files = [f for f in os.listdir() if f.endswith('.md')]

    # Sort files numerically by book and chapter numbers
    markdown_files_sorted = sorted(
        markdown_files,
        key=lambda x: extract_numbers(x) or (0, 0)  # Sort by (book, chapter) or (0, 0) if invalid
    )

    # Iterate over each markdown file
    for file_name in markdown_files_sorted:
        numbers = extract_numbers(file_name)
        if not numbers:
            print(f"Skipping file '{file_name}' (does not match the expected pattern).")
            continue

        # Extract book and chapter numbers from the filename
        book_number, chapter_number = numbers

        # Read the markdown content and strip BOM
        markdown_content = read_markdown_file(file_name)

        # Convert markdown to mobiledoc with Markdown card
        mobiledoc_content = markdown_to_mobiledoc(markdown_content)

        # Define the title and slug for the new post
        target_title = f"Chapter {chapter_number}"
        target_slug = f"chapter{chapter_number:02d}"

        # Calculate the publication time for the current chapter
        published_at = initial_published_at + timedelta(seconds=2 * (chapter_number - 1))

        # Prepare the post data
        post_data = {
            "title": target_title,
            "slug": target_slug,
            "mobiledoc": mobiledoc_content,  # Use 'mobiledoc' field with Markdown card
            "status": "published",  # Change status if needed (e.g., "draft")
            "tags": [{"name": tag_name}],  # Add tags to the post
            "authors": [{"slug": author_slug}],  # Specify the author by slug
            "codeinjection_head": code_injection_head,  # Inject code into the <head>
            "published_at": published_at.strftime("%Y-%m-%dT%H:%M:%S.000Z")  # Set the publication date
        }

        # Create the post
        create_post(post_data, token)

if __name__ == "__main__":
    main()
