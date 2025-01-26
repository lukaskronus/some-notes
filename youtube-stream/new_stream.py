import os
import json
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

# Constants
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
CREDENTIALS_FILE = "/path/to/your/youtube_credentials.json"
TIMEZONE_OFFSET = 7  # UTC+7
SCHEDULE_TIMES = ["06:00", "16:00", "20:00"]  # Times in HH:MM format

def authenticate_youtube():
    """Authenticate with the YouTube API using the credentials file."""
    if not os.path.exists(CREDENTIALS_FILE):
        raise FileNotFoundError(f"Credentials file '{CREDENTIALS_FILE}' not found.")
    with open(CREDENTIALS_FILE, "r") as file:
        creds_data = json.load(file)
    creds = Credentials.from_authorized_user_info(info=creds_data, scopes=SCOPES)
    return build("youtube", "v3", credentials=creds)

def get_existing_stream(youtube):
    """Retrieve the first persistent stream."""
    response = youtube.liveStreams().list(part="id,snippet,cdn", mine=True).execute()
    streams = response.get("items", [])
    if not streams:
        raise ValueError("No persistent live streams found. Create one manually first.")
    for stream in streams:
        if stream["cdn"]["ingestionType"] == "rtmp":  # Check for RTMP persistent streams
            print(f"Using stream ID: {stream['id']}, Title: {stream['snippet']['title']}")
            return stream["id"]
    raise ValueError("No RTMP persistent streams found.")

def get_existing_broadcasts(youtube):
    """Retrieve all existing broadcasts."""
    response = youtube.liveBroadcasts().list(part="id,snippet", broadcastType="all", mine=True).execute()
    broadcasts = response.get("items", [])
    return {
        broadcast["snippet"]["scheduledStartTime"]: broadcast["id"]
        for broadcast in broadcasts
    }

def create_broadcast(youtube, title, description, start_time, stream_id):
    """Create a YouTube live broadcast with specific settings and bind it to an existing stream."""
    broadcast_body = {
        "snippet": {
            "title": title,
            "description": description,
            "scheduledStartTime": start_time.isoformat() + "Z",
            "defaultLanguage": "en",
        },
        "status": {
            "privacyStatus": "unlisted",  # Set to unlisted
            "selfDeclaredMadeForKids": False,  # Not made for kids
        },
        "contentDetails": {
            "enableAutoStart": True,  # Enable auto-start
            "enableAutoStop": True,   # Enable auto-end
            "enableLiveChat": False,  # Disable live chat
        },
    }
    broadcast = youtube.liveBroadcasts().insert(part="snippet,status,contentDetails", body=broadcast_body).execute()

    # Bind the broadcast to the existing stream
    youtube.liveBroadcasts().bind(
        part="id,contentDetails", id=broadcast["id"], streamId=stream_id
    ).execute()

    return broadcast

def main():
    youtube = authenticate_youtube()
    now = datetime.utcnow() + timedelta(hours=TIMEZONE_OFFSET)
    today = now.date()

    # Get the existing stream ID
    stream_id = get_existing_stream(youtube)

    # Fetch existing broadcasts to avoid duplicates
    existing_broadcasts = get_existing_broadcasts(youtube)

    for schedule_time in SCHEDULE_TIMES:
        hour, minute = map(int, schedule_time.split(":"))
        scheduled_time = datetime.combine(today, datetime.min.time()) + timedelta(
            hours=hour, minutes=minute
        )
        if scheduled_time < now:
            # Skip past times
            print(f"Skipping past scheduled time: {schedule_time} UTC+7.")
            continue

        iso_scheduled_time = scheduled_time.isoformat() + "Z"
        if iso_scheduled_time in existing_broadcasts:
            print(f"Skipping duplicate broadcast for {schedule_time} UTC+7.")
            continue

        title = f"Scheduled Stream {schedule_time} UTC+7"
        description = f"This is a scheduled stream for {schedule_time} UTC+7."
        broadcast = create_broadcast(youtube, title, description, scheduled_time, stream_id)
        print(f"Scheduled stream created: {broadcast['id']} at {schedule_time}")

if __name__ == "__main__":
    main()
