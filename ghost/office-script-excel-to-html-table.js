function main(workbook: ExcelScript.Workbook) {
  // Get the first worksheet
  let sheet = workbook.getActiveWorksheet();

  // Get the used range (data range) of the worksheet
  let range = sheet.getUsedRange();
  let values = range.getValues();

  // Start building the HTML table
  let html = "<table>\n";

  // Add table headers (first row)
  html += "  <tr>\n";
  for (let col = 0; col < values[0].length; col++) {
    html += `    <th>${values[0][col]}</th>\n`;
  }
  html += "  </tr>\n";

  // Add table rows (remaining rows)
  for (let row = 1; row < values.length; row++) {
    html += "  <tr>\n";
    for (let col = 0; col < values[row].length; col++) {
      html += `    <td>${values[row][col]}</td>\n`;
    }
    html += "  </tr>\n";
  }

  html += "</table>";

  // Log the HTML table to the console (for testing)
  console.log(html);

  // Optionally, save the HTML to a cell in the workbook
  sheet.getRange("A1").setValue(html);
}
