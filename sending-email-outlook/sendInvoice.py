#!/usr/bin/python
#
# Name: uucSendInvoice.py
# Updated: April 2026
# Fix: Outbox flush before each send, sent-log to prevent duplicate delivery on rerun

import sys
import os
import os.path
import json
import pandas as pd
from datetime import datetime
import re
import locale
import unicodedata
import time
import subprocess

locale.setlocale(locale.LC_ALL, 'en_US')

# ============================================
# EMAIL SENDING CONFIGURATION
# ============================================
EMAIL_CONFIG = {
    'delay_between_emails': 6,      # Seconds between each email (increased for safety)
    'batch_size': 8,
    'batch_pause': 45,
    'retry_attempts': 3,
    'retry_delay': 15,
    'enable_queue_check': True,
    'timeout_seconds': 120,         # Increased — PowerShell now waits for confirmation
    'force_sync_after_batch': True,
    'sent_log_file': 'sent_log.json'  # Tracks successfully sent invoices across runs
}

# ============================================
# SENT LOG — prevents re-sending on rerun
# ============================================

def load_sent_log(cwd):
    """Load the set of invoice IDs that were already successfully sent."""
    log_path = os.path.join(cwd, EMAIL_CONFIG['sent_log_file'])
    if os.path.isfile(log_path):
        with open(log_path, 'r', encoding='utf-8') as f:
            return set(json.load(f))
    return set()

def save_sent_log(cwd, sent_ids):
    """Persist the set of sent invoice IDs to disk."""
    log_path = os.path.join(cwd, EMAIL_CONFIG['sent_log_file'])
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(list(sent_ids), f, indent=2)

# ============================================
# HELPER FUNCTIONS
# ============================================

def currDateTime():
    return datetime.now().strftime("%d/%m/%Y %H:%M:%S")

def isValidEmailForm(email):
    regex = r'^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$'
    return re.search(regex, email) is not None

def frmt(x):
    if pd.isna(x) or str(x).lower() in ['nan', 'nat', '-']:
        return ''
    elif isinstance(x, (int, float)):
        return str(int(x)) if float(x) == int(x) else str(x)
    else:
        return str(x).strip()

def strip_vietnamese_accents(text):
    normalized = unicodedata.normalize('NFD', str(text))
    return ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')

# ============================================
# EMAIL SENDER
# ============================================

def send_email_with_retry(templateScript, record):
    """
    Run the PowerShell template with retry logic.
    Returns: ('sent' | 'unconfirmed' | 'failed', error_message_or_None)

    Exit codes from PowerShell:
      0  = SUCCESS — confirmed in Sent Items
      1  = ERROR   — exception, attachment missing, etc.
      2  = WARNING — Send() called but delivery not confirmed within timeout
    """
    for attempt in range(EMAIL_CONFIG['retry_attempts']):
        try:
            result = subprocess.run([
                "powershell.exe",
                "-ExecutionPolicy", "Bypass",
                "-File", templateScript,
                "-ToAddress",       str(record['Email']),
                "-StudentName",     str(record['Student Name']),
                "-PdfPath",         str(record['PDF_Path']),
                "-InvoiceId",       str(record['Invoice ID']),
                "-InvoiceDate",     str(record['Invoice Date']),
                "-Year",            str(record['Year']),
                "-Season",          str(record['Season']),
                "-Description",     str(record['Fee Name Description']),
                "-FeeType",         str(record['Fee Type']),
                "-FeeAmount",       str(record['Fee Amount']),
                "-DiscountAmount",  str(record['Discount Amount']),
                "-PaidAmount",      str(record['Paid Amount']),
                "-CreditNumber",    str(record['Credit Number']),
                "-GenerationDate",  str(record['Generation_Date'])
            ], capture_output=True, text=True, timeout=EMAIL_CONFIG['timeout_seconds'])

            if result.returncode == 0:
                return ('sent', None)

            elif result.returncode == 2:
                # PowerShell sent it but couldn't confirm — treat as unconfirmed,
                # do NOT retry (retrying would cause duplicates).
                warning = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "Unconfirmed"
                return ('unconfirmed', warning)

            else:
                # Hard failure — only safe to retry if Send() was never called
                stdout_text = result.stdout.strip()
                if "Send() called" in stdout_text:
                    # Mail was already dispatched — retrying would cause duplicates
                    return ('unconfirmed', "Send() succeeded but PowerShell errored after dispatch")
                error_msg = result.stderr.strip()[:300] or stdout_text[:300]
                print(f"  Attempt {attempt+1} failed: {error_msg}")
                if attempt < EMAIL_CONFIG['retry_attempts'] - 1:
                    time.sleep(EMAIL_CONFIG['retry_delay'])

        except subprocess.TimeoutExpired:
            print(f"  Attempt {attempt+1} timed out.")
            if attempt < EMAIL_CONFIG['retry_attempts'] - 1:
                time.sleep(EMAIL_CONFIG['retry_delay'])

        except Exception as e:
            print(f"  Attempt {attempt+1} exception: {e}")
            if attempt < EMAIL_CONFIG['retry_attempts'] - 1:
                time.sleep(EMAIL_CONFIG['retry_delay'])

    return ('failed', "Max retries exceeded")


# ============================================
# MAIN PROGRAM
# ============================================
if __name__ == "__main__":

    # ── Argument parsing ───────────────────────────────────────────────────────
    xlFile    = ''
    isNoEmail = False
    isDebug   = False

    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--xls':
            xlFile = sys.argv[i+1]; i += 1
        elif sys.argv[i] == '--noemail':
            isNoEmail = True
        elif sys.argv[i] == '--debug':
            isDebug = True
        i += 1

    if not xlFile:
        print("-E-: Invalid usage.  Correct: uucSendInvoice.py --xls <Excel>")
        sys.exit(1)

    # ── Paths ──────────────────────────────────────────────────────────────────
    cwd    = os.getcwd()
    xlFile = os.path.join(cwd, xlFile.lstrip('.\\'))
    print(f"-I-: Input Excel File: {xlFile}")
    print(f"-I-: Config: delay={EMAIL_CONFIG['delay_between_emails']}s  batch={EMAIL_CONFIG['batch_size']}")

    # ── Load sent log (skip already-delivered invoices on rerun) ───────────────
    sent_ids = load_sent_log(cwd)
    if sent_ids:
        print(f"-I-: Sent log loaded — {len(sent_ids)} invoice(s) already delivered, will be skipped.")

    # ── Read Excel ─────────────────────────────────────────────────────────────
    xls = pd.read_excel(xlFile, sheet_name='DS', skiprows=[1, 2])  # Skip blank row and dummy numbering row

    fields = ["Invoice ID", "Invoice Date", "Student ID", "Student Name", "School",
              "Email", "Fee Name Description", "Season", "Year", "Fee Type",
              "Credit Number", "Fee Amount", "Discount Amount", "Paid Amount"]

    data = {}
    for _, row in xls.iterrows():
        if row['School'] not in ['UUI', 'UUC']:
            continue
        record = {f: frmt(row.get(f, '')) for f in fields}
        record['Invoice ID']            = str(int(float(record['Invoice ID']))).zfill(7)
        record['Student Name']          = strip_vietnamese_accents(record['Student Name'])
        record['Fee Name Description']  = strip_vietnamese_accents(record['Fee Name Description'])
        record['Generation_Date']       = currDateTime()
        record['PDF_Path']              = os.path.join(cwd, 'pdf', f"{record['Invoice ID']}.pdf")
        data[record['Invoice ID']]      = record

    print(f"-I-: {len(data)} invoice(s) loaded from Excel.")

    templatePSScript = os.path.join(cwd, "emailtemplate.ps1")
    if not os.path.isfile(templatePSScript):
        print(f"-E-: Template not found: {templatePSScript}")
        sys.exit(1)

    # ── Processing loop ────────────────────────────────────────────────────────
    total_invoices    = len(data)
    emails_sent       = 0
    emails_unconfirmed = 0
    emails_failed     = 0
    skipped_invoices  = []
    failed_invoices   = []
    unconfirmed_invoices = []

    print("\n" + "="*80)
    print("STARTING EMAIL PROCESSING")
    print("="*80)

    for idx, (invoiceID, record) in enumerate(data.items(), 1):
        prefix = f"[{idx}/{total_invoices}]"

        # ── Skip if already confirmed sent in a previous run ──────────────────
        if invoiceID in sent_ids:
            print(f"{prefix} -I-: SKIPPED (already sent): {invoiceID}")
            skipped_invoices.append((invoiceID, record['Student Name'], 'Already sent'))
            continue

        invoicePDF = record['PDF_Path']

        # ── Validation ────────────────────────────────────────────────────────
        if not os.path.isfile(invoicePDF):
            print(f"{prefix} -W-: PDF missing for {os.path.basename(invoicePDF)}")
            skipped_invoices.append((invoiceID, record['Student Name'], 'PDF missing'))
            continue

        if not isValidEmailForm(record['Email']):
            print(f"{prefix} -W-: Invalid email for {invoiceID}: {record['Email']}")
            skipped_invoices.append((invoiceID, record['Student Name'], 'Invalid email'))
            continue

        if float(record['Paid Amount']) == 0:
            print(f"{prefix} -I-: Zero balance — skipped: {invoiceID}")
            skipped_invoices.append((invoiceID, record['Student Name'], 'Zero balance'))
            continue

        print(f"{prefix} -I-: Sending {invoiceID} → {record['Student Name']} <{record['Email']}>")

        if not isNoEmail:
            status, error_msg = send_email_with_retry(templatePSScript, record)

            if status == 'sent':
                emails_sent += 1
                sent_ids.add(invoiceID)
                save_sent_log(cwd, sent_ids)   # Persist immediately after each success
                print(f"  ✓ Confirmed sent  (running total: {emails_sent})")

            elif status == 'unconfirmed':
                emails_unconfirmed += 1
                unconfirmed_invoices.append((invoiceID, record['Student Name'], error_msg))
                # Do NOT add to sent_ids — will be retried next run if still in Outbox
                print(f"  ⚠ Unconfirmed: {error_msg}")
                print(f"    → Check Outlook Outbox manually. Will retry on next run if not found in Sent Items.")

            else:  # 'failed'
                emails_failed += 1
                failed_invoices.append((invoiceID, record['Student Name'], error_msg))
                print(f"  ✗ Failed: {error_msg}")

            # ── Inter-email delay ──────────────────────────────────────────────
            time.sleep(EMAIL_CONFIG['delay_between_emails'])

            # ── Batch pause ────────────────────────────────────────────────────
            if emails_sent % EMAIL_CONFIG['batch_size'] == 0 \
               and emails_sent > 0 \
               and idx < total_invoices:
                print(f"\n  Batch pause — {EMAIL_CONFIG['batch_size']} sent. "
                      f"Waiting {EMAIL_CONFIG['batch_pause']}s...\n")
                time.sleep(EMAIL_CONFIG['batch_pause'])
        else:
            print(f"  --noemail: Skipped (no email sent).")

    # ── Final summary ──────────────────────────────────────────────────────────
    print("\n" + "="*80)
    print("EMAIL SENDING SUMMARY")
    print("="*80)
    print(f"Total in Excel   : {total_invoices}")
    print(f"✓ Confirmed sent : {emails_sent}")
    print(f"⚠ Unconfirmed    : {emails_unconfirmed}")
    print(f"✗ Failed          : {emails_failed}")
    print(f"— Skipped         : {len(skipped_invoices)}")
    print("="*80)

    if unconfirmed_invoices:
        print("\n⚠ Unconfirmed (check Outlook Outbox / Sent Items manually):")
        for inv, name, reason in unconfirmed_invoices:
            print(f"  - {inv} | {name}  →  {reason}")

    if failed_invoices:
        print("\n✗ Failed (will retry on next run automatically):")
        for inv, name, reason in failed_invoices:
            print(f"  - {inv} | {name}  →  {reason}")

    print(f"\nProcess completed at: {currDateTime()}")
    print(f"Sent log saved to  : {os.path.join(cwd, EMAIL_CONFIG['sent_log_file'])}")
