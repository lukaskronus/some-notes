#!/bin/sh
# Kill the saved while-loop PID if it exists
[ -f /tmp/pid.txt ] && kill $(cat /tmp/pid.txt) 2>/dev/null && rm /tmp/pid.txt
# Also kill any lingering ffmpeg processes
pkill -f ffmpeg