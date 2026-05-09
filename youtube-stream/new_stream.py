# Only install what's strictly needed
# pip install --no-cache-dir google-api-python-client google-auth-httplib2 google-auth-oauthlib

import os
import json
from datetime import datetime, timedelta, timezone

# --- Configuration (constants only, no class overhead) ---
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
CREDENTIALS_FILE = "youtube_credentials.json"
TZ = timezone(timedelta(hours=7))
SCHEDULE_TIMES = ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"]
TITLE_PREFIX = "Auto-Stream"


def authenticate():
    # Lazy import: only pulled in when function runs
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    if not os.path.exists(CREDENTIALS_FILE):
        raise FileNotFoundError(f"Missing {CREDENTIALS_FILE}")

    with open(CREDENTIALS_FILE) as f:
        creds_data = json.load(f)

    creds = Credentials.from_authorized_user_info(info=creds_data, scopes=SCOPES)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(CREDENTIALS_FILE, "w") as f:
            f.write(creds.to_json())

    return build("youtube", "v3", credentials=creds)


def get_stream_id(youtube) -> str:
    # Request only the fields we actually need
    response = youtube.liveStreams().list(
        part="id,cdn",
        mine=True,
        fields="items(id,cdn/ingestionType)"  # reduces response payload
    ).execute()

    for item in response.get("items", []):
        if item.get("cdn", {}).get("ingestionType") == "rtmp":
            return item["id"]
    raise ValueError("No RTMP stream found.")


def cleanup_today_broadcasts(youtube):
    print("Cleaning up scheduled slots...")
    page_token = None

    while True:
        kwargs = dict(
            part="id,snippet",
            broadcastStatus="upcoming",
            maxResults=50,
            fields="nextPageToken,items(id,snippet/title)"  # skip unused fields
        )
        if page_token:
            kwargs["pageToken"] = page_token

        response = youtube.liveBroadcasts().list(**kwargs).execute()

        for item in response.get("items", []):
            if item["snippet"]["title"].startswith(TITLE_PREFIX):
                b_id = item["id"]
                try:
                    youtube.liveBroadcasts().delete(id=b_id).execute()
                    print(f"  Removed: {item['snippet']['title']}")
                except Exception as e:
                    print(f"  Cleanup error: {e}")

        page_token = response.get("nextPageToken")
        if not page_token:
            break


def create_and_bind_broadcast(youtube, stream_id: str, title: str, start_dt: datetime):
    iso_start = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    broadcast = youtube.liveBroadcasts().insert(
        part="snippet,status,contentDetails",
        fields="id",  # we only need the ID back
        body={
            "snippet": {
                "title": title,
                "scheduledStartTime": iso_start,
                "description": "Daily automated security feed.",
            },
            "status": {
                "privacyStatus": "unlisted",
                "selfDeclaredMadeForKids": False
            },
            "contentDetails": {
                "enableAutoStart": True,
                "enableAutoStop": True,
                "monitorStream": {"enableMonitorStream": False}
            }
        }
    ).execute()

    youtube.liveBroadcasts().bind(
        id=broadcast["id"],
        part="id",
        streamId=stream_id,
        fields="id"  # discard unneeded bind response
    ).execute()


def schedule_today(youtube, stream_id: str):
    now = datetime.now(TZ)
    today = now.date()
    print(f"Scheduling for: {today}")

    for t_str in SCHEDULE_TIMES:
        hour, minute = map(int, t_str.split(":"))
        scheduled_dt = datetime(
            today.year, today.month, today.day,
            hour, minute, tzinfo=TZ
        )

        if scheduled_dt <= now:
            print(f"  Skipping {t_str} (already passed)")
            continue

        title = f"{TITLE_PREFIX} - {t_str}"
        try:
            create_and_bind_broadcast(youtube, stream_id, title, scheduled_dt)
            print(f"  Scheduled: {title}")
        except Exception as e:
            print(f"  Error for {t_str}: {e}")


def main():
    try:
        youtube = authenticate()
        stream_id = get_stream_id(youtube)
        cleanup_today_broadcasts(youtube)
        schedule_today(youtube, stream_id)
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")


if __name__ == "__main__":
    main()
