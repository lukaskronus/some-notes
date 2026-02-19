import os
import json
from datetime import datetime, timedelta, timezone
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# --- Configuration ---
class Config:
    SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
    CREDENTIALS_FILE = "youtube_credentials.json"
    TZ = timezone(timedelta(hours=7))  # UTC+7
    # Times to schedule within the current day
    SCHEDULE_TIMES = ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"]
    TITLE_PREFIX = "Auto-Stream"

class YouTubeScheduler:
    def __init__(self):
        self.youtube = self._authenticate()
        self.stream_id = self._get_stream_id()

    def _authenticate(self):
        if not os.path.exists(Config.CREDENTIALS_FILE):
            raise FileNotFoundError(f"Missing {Config.CREDENTIALS_FILE}")
        
        with open(Config.CREDENTIALS_FILE, "r") as file:
            creds_data = json.load(file)
        
        creds = Credentials.from_authorized_user_info(info=creds_data, scopes=Config.SCOPES)
        
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(Config.CREDENTIALS_FILE, "w") as file:
                file.write(creds.to_json())
                
        return build("youtube", "v3", credentials=creds)

    def _get_stream_id(self) -> str:
        response = self.youtube.liveStreams().list(part="id,cdn", mine=True).execute()
        for item in response.get("items", []):
            if item.get("cdn", {}).get("ingestionType") == "rtmp":
                return item["id"]
        raise ValueError("No RTMP stream found.")

    def cleanup_today_broadcasts(self):
        """Removes all upcoming automated streams to start fresh."""
        print("Cleaning up today's scheduled slots...")
        response = self.youtube.liveBroadcasts().list(
            part="id,snippet",
            broadcastStatus="upcoming",
            maxResults=50
        ).execute()
        
        for item in response.get("items", []):
            b_id = item["id"]
            title = item["snippet"]["title"]
            if title.startswith(Config.TITLE_PREFIX):
                try:
                    self.youtube.liveBroadcasts().delete(id=b_id).execute()
                    print(f"Removed: {title}")
                except Exception as e:
                    print(f"Cleanup error for {title}: {e}")

    def _create_broadcast(self, title: str, start_dt: datetime):
        iso_start = start_dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        body = {
            "snippet": {
                "title": title,
                "scheduledStartTime": iso_start,
                "description": "Daily automated security feed.",
            },
            "status": {"privacyStatus": "unlisted", "selfDeclaredMadeForKids": False},
            "contentDetails": {
                "enableAutoStart": True, 
                "enableAutoStop": True,
                "monitorStream": {"enableMonitorStream": False}
            }
        }
        broadcast = self.youtube.liveBroadcasts().insert(
            part="snippet,status,contentDetails", body=body
        ).execute()
        self.youtube.liveBroadcasts().bind(
            id=broadcast["id"], part="id,contentDetails", streamId=self.stream_id
        ).execute()

    def schedule_today_only(self):
        """Schedules slots only for the current calendar day."""
        now = datetime.now(Config.TZ)
        today_date = now.date()
        print(f"Scheduling for date: {today_date}")

        for t_str in Config.SCHEDULE_TIMES:
            hour, minute = map(int, t_str.split(":"))
            # Combine current date with the scheduled time
            scheduled_dt = datetime.combine(today_date, datetime.min.time()).replace(
                hour=hour, minute=minute, tzinfo=Config.TZ
            )

            # Check 1: Skip if the time is in the past
            if scheduled_dt < now:
                print(f"Skipping {t_str} (already passed)")
                continue

            # Check 2: Safety check to ensure it's still "today" 
            # (only relevant if running near midnight)
            if scheduled_dt.date() != today_date:
                continue

            title = f"{Config.TITLE_PREFIX} - {t_str}"
            try:
                self._create_broadcast(title, scheduled_dt)
                print(f"Successfully scheduled: {title}")
            except Exception as e:
                print(f"Error for {t_str}: {e}")

def main():
    try:
        scheduler = YouTubeScheduler()
        # Clear existing automated upcoming streams
        scheduler.cleanup_today_broadcasts()
        # Schedule only for the remainder of today
        scheduler.schedule_today_only()
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    main()
