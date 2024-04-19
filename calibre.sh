# Install calibre
sudo apt update
sudo apt install calibre -y

# Convert from epub to pdf
ebook-convert "/path/to/epub" "/path/to/pdf" \
--change-justification "justify" \ # Text changes to justify 
--paper-size a4 \ # Paper size to A4
--preserve-cover-aspect-ratio \
--pdf-add-toc \ # Add Table of Contents
--pdf-page-numbers \ # Add page number for TOC
