#!/bin/bash

# Set the RTSP link of your IP camera and YouTube stream key
RTSP_LINK=""
STREAM_KEY=""

# Start the streaming with FFmpeg (no video encoding/decoding, silent audio, output to /dev/null) and save the PID to /tmp/pid.txt
while true; do
  nice -n 10 ffmpeg \
    -rtsp_transport tcp \
    -i "$RTSP_LINK" \
    -stream_loop -1 -i silence.aac \ # Use silence.aac instead for audio
    -c:v copy \
    -c:a copy \
    -threads 2 \
    -f flv "rtmp://a.rtmp.youtube.com/live2/$STREAM_KEY" \
    > /dev/null 2>&1
  echo "Stream crashed, restarting in 5s..."
  sleep 5
done &

# Save the PID of the FFmpeg process to /tmp/pid.txt
echo $! > /tmp/pid.txt

echo "Streaming started. PID: $(cat /tmp/pid.txt)"
