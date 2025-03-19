import os
import json
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from typing import Dict, Optional

# Configuration
class Config:
    SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
    CREDENTIALS_FILE = "youtube_credentials.json"
    TIMEZONE_OFFSET = 7  # UTC+7
    SCHEDULE_TIMES = ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"]

class YouTubeScheduler:
    def __init__(self):
        self.youtube = self._authenticate()
        self.stream_id = self._get_stream_id()
        
    def _authenticate(self):
        """Authenticate with YouTube API."""
        if not os.path.exists(Config.CREDENTIALS_FILE):
            raise FileNotFoundError(f"Credentials file '{Config.CREDENTIALS_FILE}' not found")
        with open(Config.CREDENTIALS_FILE, "r") as file:
            creds_data = json.load(file)
        creds = Credentials.from_authorized_user_info(info=creds_data, scopes=Config.SCOPES)
        return build("youtube", "v3", credentials=creds)

    def _get_stream_id(self) -> str:
        """Retrieve the first RTMP persistent stream ID."""
        response = self.youtube.liveStreams().list(part="id,snippet,cdn", mine=True).execute()
        streams = response.get("items", [])
        if not streams:
            raise ValueError("No persistent live streams found. Create one manually first.")
        
        for stream in streams:
            if stream["cdn"]["ingestionType"] == "rtmp":
                print(f"Using stream: ID={stream['id']}, Title={stream['snippet']['title']}")
                return stream["id"]
        raise ValueError("No RTMP persistent streams found.")

    def _get_existing_broadcasts(self) -> Dict[str, str]:
        """Retrieve all existing broadcasts mapped by scheduled time."""
        response = self.youtube.liveBroadcasts().list(
            part="id,snippet", 
            broadcastType="all", 
            mine=True
        ).execute()
        return {
            broadcast["snippet"]["scheduledStartTime"]: broadcast["id"]
            for broadcast in response.get("items", [])
        }

    def _create_broadcast(self, title: str, description: str, start_time: datetime) -> dict:
        """Create and bind a YouTube live broadcast."""
        broadcast_body = {
            "snippet": {
                "title": title,
                "description": description,
                "scheduledStartTime": start_time.isoformat() + "Z",
                "defaultLanguage": "en",
            },
            "status": {
                "privacyStatus": "unlisted",
                "selfDeclaredMadeForKids": False,
            },
            "contentDetails": {
                "enableAutoStart": True,
                "enableAutoStop": True,
                "enableLiveChat": False,
                "liveChatId": None,
            },
        }

        broadcast = self.youtube.liveBroadcasts().insert(
            part="snippet,status,contentDetails", 
            body=broadcast_body
        ).execute()

        self.youtube.liveBroadcasts().bind(
            part="id,contentDetails", 
            id=broadcast["id"], 
            streamId=self.stream_id
        ).execute()

        return broadcast

    def schedule_broadcasts(self):
        """Schedule broadcasts for the day."""
        now = datetime.utcnow() + timedelta(hours=Config.TIMEZONE_OFFSET)
        today = now.date()
        existing_broadcasts = self._get_existing_broadcasts()

        for schedule_time in Config.SCHEDULE_TIMES:
            hour, minute = map(int, schedule_time.split(":"))
            scheduled_time = datetime.combine(today, datetime.min.time()) + timedelta(
                hours=hour, minutes=minute
            )

            if scheduled_time < now:
                print(f"Skipping past time: {schedule_time}")
                continue

            iso_time = scheduled_time.isoformat() + "Z"
            if iso_time in existing_broadcasts:
                print(f"Skipping existing broadcast at {schedule_time}")
                continue

            title = f"Scheduled Stream {scheduled_time.strftime('%d-%m-%Y')} {schedule_time}"
            description = f"Scheduled stream for {scheduled_time.strftime('%d-%m-%Y')} {schedule_time} - Front yard camera"
            
            try:
                broadcast = self._create_broadcast(title, description, scheduled_time)
                print(f"Created broadcast: ID={broadcast['id']} at {schedule_time}")
            except Exception as e:
                print(f"Failed to create broadcast at {schedule_time}: {str(e)}")

def main():
    try:
        scheduler = YouTubeScheduler()
        scheduler.schedule_broadcasts()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
