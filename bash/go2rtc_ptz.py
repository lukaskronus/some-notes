#!/usr/bin/env python3

# Change the iframe matching your CONFIG in line 206
# Change the /stream.html?src=ranger2&mode=mse according to your go2rtc config in line 217

import hashlib
import base64
import os
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

# ====== CONFIG ======
CAMERA_IP     = "YOUR-IP-CAMERA-ADDRESS"
USERNAME      = "YOUR-IP-CAMERA-USERNAME"
PASSWORD      = "YOUR-IP-CAMERA-PASSWORD"
PROFILE       = "ONVIF-PROFILE"
PTZ_URL       = f"http://{CAMERA_IP}/onvif/ptz_service"

# Local addresses
LOCAL_GO2RTC  = "http://192.168.1.xx:1984"      # ← change to your server local IP
LOCAL_PTZ     = "http://192.168.1.xx:8080"

# Public addresses (Cloudflare)
PUBLIC_GO2RTC = "https://cam.yourdomain.com"
PUBLIC_PTZ    = "https://ptz.yourdomain.com"

LISTEN_PORT   = 8080
SPEED         = 0.18
# ====================
def make_security_header():
    nonce = os.urandom(16)
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    digest = base64.b64encode(
        hashlib.sha1(nonce + created.encode() + PASSWORD.encode()).digest()
    ).decode()
    nonce_b64 = base64.b64encode(nonce).decode()
    return f'''
    <Security s:mustUnderstand="1"
        xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <UsernameToken>
        <Username>{USERNAME}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</Nonce>
        <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">{created}</Created>
      </UsernameToken>
    </Security>'''

def send_soap(body: str) -> bool:
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Header>
    {make_security_header()}
  </s:Header>
  <s:Body>
    {body}
  </s:Body>
</s:Envelope>'''
    headers = {"Content-Type": "application/soap+xml; charset=utf-8"}
    try:
        req = urllib.request.Request(PTZ_URL, data=xml.encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=2) as resp:
            return resp.status == 200
    except Exception as e:
        print("SOAP error:", e)
        return False

def continuous_move(pan=0.0, tilt=0.0):
    body = f'''
    <ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>{PROFILE}</ProfileToken>
      <Velocity>
        <PanTilt x="{pan}" y="{tilt}" xmlns="http://www.onvif.org/ver10/schema"/>
      </Velocity>
    </ContinuousMove>'''
    return send_soap(body)

def stop_move():
    body = f'''
    <Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>{PROFILE}</ProfileToken>
      <PanTilt>true</PanTilt>
      <Zoom>true</Zoom>
    </Stop>'''
    return send_soap(body)

HTML = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Ranger 2 PTZ</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{
    height: 100%;
    background: #0b0b0b;
    color: #eee;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }}
  .container {{
    display: flex;
    height: 100vh;
    width: 100vw;
  }}
  /* Left pane - Camera (≈ 75-80%) */
  .video-pane {{
    flex: 3.2;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }}
  .video-pane iframe {{
    width: 100%;
    height: 100%;
    border: none;
    background: #000;
  }}
  /* Right pane - Controls (≈ 20-25%) */
  .control-pane {{
    flex: 1;
    min-width: 160px;
    max-width: 220px;
    background: #141414;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 16px 10px;
    border-left: 1px solid #222;
  }}
  .pad {{
    display: grid;
    grid-template-columns: repeat(3, 64px);
    grid-template-rows: repeat(3, 64px);
    gap: 8px;
  }}
  button {{
    width: 64px;
    height: 64px;
    font-size: 24px;
    border: none;
    border-radius: 12px;
    background: #2a2a2a;
    color: #fff;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.08s;
  }}
  button:active, button.active {{
    background: #3b82f6;
  }}
  .stop {{
    background: #dc2626;
  }}
  .stop:active, .stop.active {{
    background: #b91c1c;
  }}
  .title {{
    font-size: 0.95rem;
    font-weight: 600;
    color: #d1d5db;
    text-align: center;
  }}
  .hint {{
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
    line-height: 1.3;
  }}
  /* Mobile: stack vertically if screen is narrow */
  @media (max-width: 700px) {{
    .container {{
      flex-direction: column;
    }}
    .video-pane {{
      flex: 1;
      min-height: 55vh;
    }}
    .control-pane {{
      flex: none;
      max-width: none;
      width: 100%;
      flex-direction: row;
      justify-content: center;
      gap: 20px;
      padding: 12px;
      border-left: none;
      border-top: 1px solid #222;
    }}
  }}
</style>
</head>
<body>
<div class="container">
  <!-- Large camera view -->
  <div class="video-pane">
    <iframe id="stream" allow="autoplay" style="width:100%; height:100%; border:none; background:#000;"></iframe>

    <script>
      // Auto-detect local vs remote
      const isLocal = location.hostname.startsWith("192.168.") || 
                      location.hostname === "localhost" || 
                      location.hostname === "127.0.0.1";
    
      const go2rtcBase = isLocal ? "http://192.168.1.xx:1984" : "https://cam.yourdomain.com";
    
      document.getElementById("stream").src = go2rtcBase + "/stream.html?src=ranger2&mode=mse";
    </script>
  </div>

  <!-- Compact control pane -->
  <div class="control-pane">
    <div class="title">PTZ Control</div>

    <div class="pad">
      <div></div>
      <button data-dir="up">▲</button>
      <div></div>

      <button data-dir="left">◀</button>
      <button class="stop" data-dir="stop">■</button>
      <button data-dir="right">▶</button>

      <div></div>
      <button data-dir="down">▼</button>
      <div></div>
    </div>

    <div class="hint">Hold to move<br>Release to stop</div>
  </div>
</div>

<script>
const SPEED = {SPEED};
let currentDir = null;

function startMove(dir) {{
  if (dir === "stop") {{
    fetch("/ptz?dir=stop");
    currentDir = null;
    return;
  }}
  if (currentDir === dir) return;
  currentDir = dir;
  fetch("/ptz?dir=" + dir + "&action=start");
}}

function stopMove() {{
  if (currentDir) {{
    fetch("/ptz?dir=stop");
    currentDir = null;
  }}
}}

document.querySelectorAll("button[data-dir]").forEach(btn => {{
  const dir = btn.dataset.dir;

  // Mouse
  btn.addEventListener("mousedown", e => {{
    e.preventDefault();
    btn.classList.add("active");
    startMove(dir);
  }});
  btn.addEventListener("mouseup", () => {{
    btn.classList.remove("active");
    if (dir !== "stop") stopMove();
  }});
  btn.addEventListener("mouseleave", () => {{
    btn.classList.remove("active");
    if (dir !== "stop") stopMove();
  }});

  // Touch
  btn.addEventListener("touchstart", e => {{
    e.preventDefault();
    btn.classList.add("active");
    startMove(dir);
  }}, {{ passive: false }});
  btn.addEventListener("touchend", () => {{
    btn.classList.remove("active");
    if (dir !== "stop") stopMove();
  }});
  btn.addEventListener("touchcancel", () => {{
    btn.classList.remove("active");
    if (dir !== "stop") stopMove();
  }});
}});

// Keyboard
const keyMap = {{
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  " ": "stop"
}};
document.addEventListener("keydown", e => {{
  const dir = keyMap[e.key];
  if (!dir || e.repeat) return;
  e.preventDefault();
  startMove(dir);
}});
document.addEventListener("keyup", e => {{
  const dir = keyMap[e.key];
  if (dir && dir !== "stop") stopMove();
}});
</script>
</body>
</html>
'''

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(HTML.encode())
        elif parsed.path == "/ptz":
            qs = parse_qs(parsed.query)
            direction = qs.get("dir", [""])[0]
            action = qs.get("action", ["start"])[0]

            ok = False
            if direction == "stop":
                ok = stop_move()
            elif direction in ("up", "down", "left", "right") and action == "start":
                mapping = {
                    "up":    (0, SPEED),
                    "down":  (0, -SPEED),
                    "left":  (-SPEED, 0),
                    "right": (SPEED, 0),
                }
                pan, tilt = mapping[direction]
                ok = continuous_move(pan, tilt)
            else:
                ok = True

            self.send_response(200 if ok else 500)
            self.end_headers()
            self.wfile.write(b"OK" if ok else b"ERR")
        else:
            self.send_error(404)

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    print(f"PTZ web UI → http://0.0.0.0:{LISTEN_PORT}")
    HTTPServer(("", LISTEN_PORT), Handler).serve_forever()
