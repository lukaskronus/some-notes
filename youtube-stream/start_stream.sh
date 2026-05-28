#!/bin/sh
RTSP_LINK=""
STREAM_KEY=""

# Kill any leftover ffmpeg from a previous session before starting
pkill -f ffmpeg
sleep 2

while true; do
  nice -n 10 ffmpeg \
    -rtsp_transport tcp \
    -i "$RTSP_LINK" \
    -stream_loop -1 -i silence.aac \
    -c:v copy \
    -c:a copy \
    -threads 2 \
    -f flv "rtmp://a.rtmp.youtube.com/live2/$STREAM_KEY" \
    > /dev/null 2>&1
  echo "Stream crashed, restarting in 5s..."
  sleep 5
done &

echo $! > /tmp/pid.txt
echo "Streaming started. PID: $(cat /tmp/pid.txt)"