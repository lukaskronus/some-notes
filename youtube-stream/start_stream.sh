#!/bin/bash

# Set the RTSP link of your IP camera and YouTube stream key
RTSP_LINK=""
STREAM_KEY=""

# Start the streaming with FFmpeg (no video encoding/decoding, silent audio, output to /dev/null) and save the PID to /tmp/pid.txt
ffmpeg -i "$RTSP_LINK" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac -shortest -f flv "rtmp://a.rtmp.youtube.com/live2/$STREAM_KEY" > /dev/null 2>&1 &

# Save the PID of the FFmpeg process to /tmp/pid.txt
echo $! > /tmp/pid.txt

echo "Streaming started. PID: $(cat /tmp/pid.txt)"