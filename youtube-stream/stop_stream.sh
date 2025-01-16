#!/bin/bash
[ -f /tmp/pid.txt ] && kill $(cat /tmp/pid.txt) && rm /tmp/pid.txt