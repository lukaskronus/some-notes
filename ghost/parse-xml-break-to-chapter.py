import xml.etree.ElementTree as ET

def collect_verses(filename, book_number):
    """Collect verses from the specified book number as a dictionary: {chapter: {(verse): text}}."""
    verses = {}
    try:
        tree = ET.parse(filename)
        root = tree.getroot()
        
        for testament in root.findall('testament'):
            for book in testament.findall('book'):
                if book.get('number') == book_number:
                    for chapter in book.findall('chapter'):
                        chap_num = chapter.get('number')
                        verses[chap_num] = {}
                        for verse in chapter.findall('verse'):
                            verse_num = verse.get('number')
                            text = verse.text.strip() if verse.text else ''
                            verses[chap_num][verse_num] = text
                    return verses  # Stop after processing the desired book
    except ET.ParseError as e:
        print(f"Error parsing {filename}: {e}")
    return verses

# Parse the XML files to get all unique book numbers
def get_book_numbers(filename):
    """Extracts all book numbers from the XML file."""
    book_numbers = set()
    try:
        tree = ET.parse(filename)
        root = tree.getroot()
        
        for testament in root.findall('testament'):
            for book in testament.findall('book'):
                book_numbers.add(book.get('number'))
    except ET.ParseError as e:
        print(f"Error parsing {filename}: {e}")
    return book_numbers

# Get all book numbers from the XML files
book_numbers = get_book_numbers('SBL.xml')

# Process each book number
for book_number in book_numbers:
    # Collect verses from each XML file as dictionaries
    sbl = collect_verses('SBL.xml', book_number)
    vie = collect_verses('VIE.xml', book_number)
    net = collect_verses('NET.xml', book_number)
    
    # Collect all unique chapter numbers
    all_chapters = set(sbl.keys()).union(vie.keys()).union(net.keys())
    
    # Process each chapter
    for chapter in all_chapters:
        # Collect all unique verse numbers for the current chapter and sort them numerically
        all_keys = set(sbl.get(chapter, {}).keys()).union(vie.get(chapter, {}).keys()).union(net.get(chapter, {}).keys())
        sorted_keys = sorted(all_keys, key=lambda x: int(x))
        
        # Create a filename based on the book number and chapter number
        output_filename = f'{book_number}-{chapter}.md'
        
        # Write the output file in Markdown format
        with open(output_filename, 'w', encoding='utf-8-sig') as f_out:
            for verse in sorted_keys:
                prefix = f"[{verse}] "
                
                # Get text from each file or empty string if missing
                line_sbl = prefix + sbl.get(chapter, {}).get(verse, '')
                line_vie = prefix + vie.get(chapter, {}).get(verse, '')
                line_net = prefix + net.get(chapter, {}).get(verse, '')
                
                # Format SBL line in bold
                line_sbl = f"**{line_sbl}**" if line_sbl.strip() else prefix
                
                # Write the three lines followed by an empty line
                f_out.write(f"{line_sbl}\n")
                f_out.write(f"{line_vie}\n")
                f_out.write(f"{line_net}\n")
                f_out.write("\n")
