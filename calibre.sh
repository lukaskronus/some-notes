# Install calibre
sudo apt update
sudo apt install calibre -y

# Convert from epub to pdf
ebook-convert "/path/to/epub" "/path/to/pdf" \
--change-justification "justify" \
--margin-bottom 34 --margin-left 72 --margin-right 72 --margin-top 72 \
--paper-size a4 \
--preserve-cover-aspect-ratio \
--pdf-add-toc \
--pdf-page-numbers
