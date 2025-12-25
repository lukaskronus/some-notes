import os
import json
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# Configuration
class Config:
    SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
    CREDENTIALS_FILE = "youtube_credentials.json"
    TIMEZONE_OFFSET = 7  # UTC+7

def get_youtube_service():
    if not os.path.exists(Config.CREDENTIALS_FILE):
        raise FileNotFoundError(f"Credentials file not found: {Config.CREDENTIALS_FILE}")

    with open(Config.CREDENTIALS_FILE, "r") as f:
        creds_data = json.load(f)

    credentials = Credentials.from_authorized_user_info(creds_data, Config.SCOPES)

    if not credentials.valid:
        if credentials.expired and credentials.refresh_token:
            print("Credentials expired. Refreshing...")
            try:
                credentials.refresh(Request())
                with open(Config.CREDENTIALS_FILE, "w") as f:
                    f.write(credentials.to_json())
                print("Credentials refreshed and saved successfully.")
            except Exception as e:
                raise ValueError(f"Failed to refresh credentials. Error: {e}")
        else:
            raise ValueError("Credentials invalid and no refresh token found.")

    return build("youtube", "v3", credentials=credentials)

def get_persistent_stream_id(youtube):
    """Retrieve the reusable persistent stream ID."""
    response = youtube.liveStreams().list(part="id,contentDetails", mine=True).execute()
    for item in response.get("items", []):
        if item.get("contentDetails", {}).get("isReusable", False):
            print(f"Using persistent stream ID: {item['id']}")
            return item["id"]
    raise ValueError("No reusable persistent stream found. Create one manually in YouTube Studio.")

def end_current_live_broadcast(youtube):
    """End any currently live broadcast."""
    # FIX: Cannot use 'mine' and 'broadcastStatus' together. 
    # We request 'mine=True' and filter manually for 'lifeCycleStatus' == 'live'.
    request = youtube.liveBroadcasts().list(
        part="id,status",
        mine=True
    )
    response = request.execute()

    ended_count = 0
    for item in response.get("items", []):
        # Check if the broadcast is actually 'live' right now
        if item.get("status", {}).get("lifeCycleStatus") == "live":
            broadcast_id = item["id"]
            try:
                youtube.liveBroadcasts().transition(
                    broadcastStatus="complete",
                    id=broadcast_id,
                    part="id,status"
                ).execute()
                print(f"Ended previous live broadcast: {broadcast_id}")
                ended_count += 1
            except HttpError as e:
                print(f"Failed to end broadcast {broadcast_id}: {e}")

    if ended_count == 0:
        print("No active live broadcast found to end.")

def get_current_slot_label():
    """Return a clean label for the current 4-hour slot (e.g., '02:00', '22:00')."""
    local_now = datetime.utcnow() + timedelta(hours=Config.TIMEZONE_OFFSET)
    hour = local_now.hour
    slot_hour = (hour // 4) * 4
    if slot_hour == 0:
        slot_hour = 22  # Represent 00:00–02:00 slot as 22:00 (previous day)
    return f"{slot_hour:02d}:00"

def create_and_start_new_broadcast(youtube, stream_id):
    local_now = datetime.utcnow() + timedelta(hours=Config.TIMEZONE_OFFSET)
    slot_label = get_current_slot_label()

    # Start immediately
    start_time_utc = datetime.utcnow().isoformat() + "Z"

    title = f"Front Yard Camera - {slot_label} ({local_now.strftime('%d-%m-%Y')})"
    description = f"Live stream slot starting at {slot_label} local time - Front yard camera"

    broadcast_body = {
        "snippet": {
            "title": title,
            "description": description,
            "scheduledStartTime": start_time_utc
        },
        "status": {
            "privacyStatus": "unlisted",
            "selfDeclaredMadeForKids": False
        },
        "contentDetails": {
            "enableAutoStart": False,
            "enableAutoStop": False,
            "monitorStream": {"enableMonitorStream": False},
            "enableLiveChat": False
        }
    }

    # Create broadcast
    broadcast = youtube.liveBroadcasts().insert(
        part="snippet,status,contentDetails",
        body=broadcast_body
    ).execute()

    broadcast_id = broadcast["id"]
    print(f"Created new broadcast: {broadcast_id}")
    print(f"Watch page: https://youtube.com/watch?v={broadcast_id}")

    # Bind to persistent stream
    youtube.liveBroadcasts().bind(
        part="id,contentDetails",
        id=broadcast_id,
        streamId=stream_id
    ).execute()
    print("Bound to persistent stream.")

    # Go live immediately
    try:
        youtube.liveBroadcasts().transition(
            broadcastStatus="live",
            id=broadcast_id,
            part="id,status"
        ).execute()
        print(f"New broadcast {broadcast_id} is now LIVE!")
    except HttpError as e:
        print(f"Failed to transition to live: {e}")
        print("Note: This can occur if no ingestion data is present yet. The broadcast will go live when data arrives.")

def main():
    youtube = get_youtube_service()
    stream_id = get_persistent_stream_id(youtube)

    end_current_live_broadcast(youtube)
    create_and_start_new_broadcast(youtube, stream_id)

if __name__ == "__main__":
    main()
