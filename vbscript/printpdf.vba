Sub PrintPDF()

    Dim p1 As Long, p2 As Long, i As Long
    Dim ws As Worksheet
    Dim selectedRange As Range
    Dim filePath As String
    Dim filename As String
    Dim pdfPath As String
    
    ' Set the worksheet
    Set ws = ThisWorkbook.Sheets("Sheet2")
    
    ' Get start and end values from cells
    p1 = ws.Range("E2").Value
    p2 = ws.Range("F2").Value
    
    ' Validate values
    If Not IsNumeric(p1) Or Not IsNumeric(p2) Then
        MsgBox "Both start and end values must be numeric.", vbExclamation, "Input Error"
        Exit Sub
    End If
    If p1 > p2 Then
        MsgBox "End value must be greater than or equal to start value.", vbExclamation, "Input Error"
        Exit Sub
    End If
    
    ' Set the file path (adjust the folder path as necessary)
    filePath = "D:\Project\"
    
    ' Check if file path exists
    If Dir(filePath, vbDirectory) = "" Then
        MsgBox "The specified file path does not exist.", vbExclamation, "Error"
        Exit Sub
    End If
    
    ' Set page size and orientation once
    With ws.PageSetup
        .PaperSize = xlPaperA5
        .Orientation = xlLandscape
        .Zoom = False ' Disable zoom
        .FitToPagesWide = 1
        .FitToPagesTall = False ' Optional: can set this to 1 to fit tall pages as well
    End With
    
    ' Print each page
    For i = p1 To p2
        ' Update the cell with the current value
        ws.Range("D2").Value = i

        ' Define the range to export (adjust as needed)
        Set selectedRange = ws.Range("A1:B3") ' Adjust this range as needed

        ' Set the print area to the selected range
        ws.PageSetup.PrintArea = selectedRange.Address
        
        ' Update filename based on cell value (e.g., cell H9)
        filename = ws.Range("B1").Value
        
        ' Ensure the filename does not contain invalid characters
        filename = CleanFilename(filename)
        
        ' Combine file path and filename
        pdfPath = filePath & filename & ".pdf"
        
        ' Export the selected range to a PDF
        ws.ExportAsFixedFormat Type:=xlTypePDF, filename:=pdfPath, Quality:=xlQualityStandard
        
        ' Debug message to check filename and path
        Debug.Print "Saved PDF as: " & pdfPath
    Next i
    
    MsgBox "Print job completed. Files should be saved in: " & filePath
End Sub

' Function to clean filenames by removing illegal characters
Function CleanFilename(filename As String) As String
    Dim invalidChars As Variant
    Dim char As Variant
    invalidChars = Array("\", "/", ":", "*", "?", """", "<", ">", "|")
    
    ' Replace each invalid character with an underscore
    For Each char In invalidChars
        filename = Replace(filename, char, "_")
    Next char
    
    ' Optionally trim whitespace from filename
    CleanFilename = Trim(filename)
End Function
