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
            try:
                credentials.refresh(Request())
                with open(Config.CREDENTIALS_FILE, "w") as f:
                    f.write(credentials.to_json())
            except Exception as e:
                raise ValueError(f"Failed to refresh credentials: {e}")
    
    return build("youtube", "v3", credentials=credentials, static_discovery=False)

def get_persistent_stream_id(youtube):
    response = youtube.liveStreams().list(part="id,contentDetails", mine=True).execute()
    for item in response.get("items", []):
        if item.get("contentDetails", {}).get("isReusable", False):
            return item["id"]
    raise ValueError("No reusable persistent stream found.")

def manage_broadcast(youtube, stream_id):
    # Calculate local time and target title
    local_now = datetime.utcnow() + timedelta(hours=Config.TIMEZONE_OFFSET)
    slot_label = local_now.strftime('%H:00')
    date_label = local_now.strftime('%d-%m-%Y')
    target_title = f"Front Yard Camera - {slot_label} ({date_label})"

    # 1. Check for existing active broadcasts
    request = youtube.liveBroadcasts().list(part="id,snippet,status", mine=True)
    response = request.execute()
    
    active_broadcast = None
    for item in response.get("items", []):
        status = item.get("status", {}).get("lifeCycleStatus")
        if status in ("live", "testing"):
            # If a broadcast is already running with the CORRECT title, just exit
            if item["snippet"]["title"] == target_title:
                print(f"Broadcast '{target_title}' is already running. No action needed.")
                return
            active_broadcast = item["id"]

    # 2. If we found an old broadcast, end it
    if active_broadcast:
        print(f"Ending old broadcast: {active_broadcast}")
        youtube.liveBroadcasts().transition(
            broadcastStatus="complete", id=active_broadcast, part="id,status"
        ).execute()

    # 3. Create the new broadcast
    print(f"Creating new broadcast: {target_title}")
    start_time_utc = datetime.utcnow().isoformat() + "Z"
    
    broadcast_body = {
        "snippet": {
            "title": target_title,
            "description": f"Live stream started at {slot_label}",
            "scheduledStartTime": start_time_utc
        },
        "status": {"privacyStatus": "unlisted", "selfDeclaredMadeForKids": False},
        "contentDetails": {
            "enableAutoStart": True, # Automatically starts when your encoder sends data
            "enableAutoStop": True,  # Automatically ends when encoder stops
            "monitorStream": {"enableMonitorStream": False}
        }
    }

    broadcast = youtube.liveBroadcasts().insert(
        part="snippet,status,contentDetails", body=broadcast_body
    ).execute()
    
    broadcast_id = broadcast["id"]

    # 4. Bind to stream
    youtube.liveBroadcasts().bind(
        part="id,contentDetails", id=broadcast_id, streamId=stream_id
    ).execute()
    
    print(f"Done. Live at: https://youtube.com/watch?v={broadcast_id}")

def main():
    try:
        youtube = get_youtube_service()
        stream_id = get_persistent_stream_id(youtube)
        manage_broadcast(youtube, stream_id)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
