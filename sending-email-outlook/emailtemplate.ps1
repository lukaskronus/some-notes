# =============================================
# emailtemplate.ps1 - Fixed Version
# =============================================

param(
    [string]$ToAddress,
    [string]$StudentName,
    [string]$PdfPath,
    [string]$InvoiceId,
    [string]$InvoiceDate,
    [string]$Year,
    [string]$Season,
    [string]$Description,
    [string]$FeeType,
    [string]$FeeAmount,
    [string]$DiscountAmount,
    [string]$PaidAmount,
    [string]$CreditNumber,
    [string]$GenerationDate
)

$outlook = $null
$mail    = $null

try {
    #  1. Connect to Outlook 
    # Outlook is always open - we should always be able to attach to it.
    # Retry up to 5 times in case the previous PowerShell process hasn't fully
    # released the COM connection yet.
    $maxAttempts = 5
    $attempt     = 0
    $outlook     = $null

    while ($attempt -lt $maxAttempts -and $outlook -eq $null) {
        try {
            $outlook = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Outlook.Application")
            Write-Host "INFO: Attached to existing Outlook instance (attempt $($attempt + 1))."
        } catch {
            $attempt++
            if ($attempt -lt $maxAttempts) {
                Write-Host "INFO: Outlook COM not ready yet, retrying in 3s... ($attempt/$maxAttempts)"
                Start-Sleep -Seconds 3
            } else {
                throw "ERROR: Could not attach to Outlook after $maxAttempts attempts. Is Outlook open?"
            }
        }
    }

    $namespace = $outlook.GetNamespace("MAPI")
    $namespace.Logon($null, $null, $false, $true)   # Ensure MAPI session is fully ready

    #  2. Flush the Outbox BEFORE composing a new email 
    # This prevents a stuck email from blocking the queue when we re-run.
    $outbox = $namespace.GetDefaultFolder(4)   # 4 = olFolderOutbox
    if ($outbox.Items.Count -gt 0) {
        Write-Host "INFO: $($outbox.Items.Count) item(s) already in Outbox. Flushing first..."
        $namespace.SendAndReceive($true)        # Must call on NameSpace, not Application
        Start-Sleep -Seconds 5

        # Wait up to 30 s for Outbox to clear
        $waited = 0
        while ($outbox.Items.Count -gt 0 -and $waited -lt 30) {
            Start-Sleep -Seconds 3
            $waited += 3
        }
        if ($outbox.Items.Count -gt 0) {
            Write-Host "WARNING: Outbox still has $($outbox.Items.Count) item(s) after flush."
        } else {
            Write-Host "INFO: Outbox cleared."
        }
    }

    #  3. Compose the email 
    $mail = $outlook.CreateItem(0)   # 0 = olMailItem

    $mail.SentOnBehalfOfName = "finance@uuc.edu"

    # Resolve recipient explicitly to avoid "Outlook does not recognize one or more names"
    $recipient = $mail.Recipients.Add($ToAddress)
    $recipient.Type = 1   # 1 = olTo
    if (-not $recipient.Resolve()) {
        # If address book resolution fails, force SMTP addressing directly
        $recipient.Delete()
        $mail.To = $ToAddress
    }

    $mail.CC  = "registrar@uuc.edu; admissions@uuc.edu; studentaffairs@uuc.edu"
    $mail.BCC = "giang.le@uuc.edu"
    $mail.Subject = "Invoice Notification - $InvoiceId"

    $mail.Attachments.Add($PdfPath) | Out-Null

    $mail.BodyFormat = 2   # olFormatHTML
    $mail.HTMLBody = @"
<html>
<body>
    Hello <b>$StudentName</b>,<br><br>
    We are sending you this email to notify you about making payment for
    <b>$Year - $Season - Tuition - $Description</b>.<br><br>

    <span style="font-size:16px;color:blue;font-weight:bold">Summary of Invoice<br></span>
    Invoice: <b>$Year - $Season - Tuition - $Description</b><br>
    Invoice ID: <b>$InvoiceId</b><br>
    Invoice Type: Tuition Fee<br>
    Amount : <b>`$$FeeAmount USD</b><br>
    Discount: <b>`$$DiscountAmount USD</b><br>
    Balance : <b>`$$PaidAmount USD</b><br>
    Description: <b>$FeeType : $FeeAmount USD / $CreditNumber credits</b><br>
    Due Date: <b>$InvoiceDate</b><br><br>

    Please contact the UUC finance office if you have any questions regarding this notice.<br><br>

    Sincerely,<br>
    <span style="font-size:20px;color:purple;font-weight:bold">Union University of California<br></span>
    <br>Invoice Date: $GenerationDate
</body>
</html>
"@

    #  4. Send 
    $sentFolder      = $namespace.GetDefaultFolder(5)   # 5 = olFolderSentMail
    $sentCountBefore = $sentFolder.Items.Count

    $mail.Send()
    Write-Host "INFO: Send() called for $ToAddress (Invoice: $InvoiceId)"
    # NOTE: Once Send() succeeds the mail item is owned by Outlook's queue.
    # Any error after this point must NOT cause Python to retry - doing so
    # would send duplicates. We exit 0 immediately after Send() succeeds.
    $mail = $null   # Release reference; Outlook owns it now

    #  5. Sync & confirm 
    Start-Sleep -Milliseconds 500

    try {
        # SendAndReceive lives on the NameSpace object, not Application
        $namespace.SendAndReceive($true)
    } catch {
        Write-Host "INFO: SendAndReceive skipped - $($_.Exception.Message)"
        # Non-fatal: mail is already queued, just exit success
        exit 0
    }

    $waited    = 0
    $confirmed = $false
    while ($waited -lt 30) {
        Start-Sleep -Seconds 2
        $waited += 2
        if ($sentFolder.Items.Count -gt $sentCountBefore -or $outbox.Items.Count -eq 0) {
            $confirmed = $true
            break
        }
    }

    if ($confirmed) {
        Write-Host "SUCCESS: Email delivered for $ToAddress (Invoice: $InvoiceId)"
    } else {
        Write-Host "WARNING: Could not confirm delivery within 30s for $InvoiceId - check Outbox manually."
        # Still exit 0 - mail was sent, just unconfirmed. Python must NOT retry.
        exit 0
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    exit 1
}
finally {
    #  5. Clean COM objects in the right order 
    # Release mail first, then namespace, then outlook.
    # Never release outlook while a Send is in flight - that's what caused the drops.
    if ($null -ne $mail) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($mail)    | Out-Null
    }
    if ($null -ne $namespace) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($namespace) | Out-Null
    }
    # Do NOT release $outlook - let the process own it for the session lifetime.
    # Python will keep the PowerShell process short-lived anyway.
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
