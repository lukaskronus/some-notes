# Install calibre
sudo apt update
sudo apt install calibre -y

# Convert from epub to pdf
ebook-convert "/path/to/epub" "/path/to/pdf" \
--change-justification "justify" \
--paper-size a4 \
--preserve-cover-aspect-ratio \
--pdf-add-toc \
--pdf-page-numbers

# A small loop to process all files in same directory

#!/bin/bash

# Directory containing EPUB files
epub_dir="/mnt/e/Downloads"

# Loop through each EPUB file in the directory
for epub_file in "$epub_dir"/*.epub; do
    # Check if file exists
    if [ -e "$epub_file" ]; then
        echo "Processing file: $epub_file"
        # Add your processing commands here
        ebook-convert "$epub_file" "${epub_file%.epub}.pdf" --change-justification "justify" --paper-size a4 --preserve-cover-aspect-ratio --pdf-add-toc --pdf-page-numbers
        echo "Processing complete for $epub_file"
    else
        echo "No EPUB files found in directory: $epub_dir"
    fi
done
