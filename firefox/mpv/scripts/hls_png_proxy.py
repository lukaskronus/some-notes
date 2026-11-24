#!/usr/bin/env python3
import http.server
import socketserver
import urllib.request
import urllib.parse
import ssl
import sys

PORT = 12082

def find_ts_start(data: bytes) -> int:
    n = len(data)
    if n < 188:
        return -1
    # Search for MPEG-TS sync byte 0x47 repeating every 188 bytes
    for i in range(min(8192, n - 188 * 3)):
        if data[i] == 0x47:
            is_ts = True
            for j in range(1, 4):
                if data[i + j * 188] != 0x47:
                    is_ts = False
                    break
            if is_ts:
                return i
    return -1

def find_media_start(data: bytes) -> int:
    ts_idx = find_ts_start(data)
    if ts_idx != -1:
        return ts_idx
    
    # Search for fMP4 boxes: 'ftyp', 'moof', 'mdat'
    n = len(data)
    for i in range(min(8192, n - 8)):
        if data[i+4:i+8] in (b'ftyp', b'moof', b'mdat'):
            return i
    return 0

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Silence standard HTTP logging to keep mpv console clean
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_url.query)
        
        path = parsed_url.path
        if path == '/play':
            url = query.get('url', [None])[0]
            if url:
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b"OK")
            return
            
        elif path == '/m3u8':
            url = query.get('url', [None])[0]
            if not url:
                self.send_error(400, "Missing 'url' parameter")
                return
            
            referer = query.get('referer', [None])[0]
            ua = query.get('ua', [None])[0]
            
            # Fetch the original m3u8
            req = urllib.request.Request(url)
            if referer:
                req.add_header('Referer', referer)
            if ua:
                req.add_header('User-Agent', ua)
                
            ctx = ssl._create_unverified_context()
            try:
                with urllib.request.urlopen(req, context=ctx) as response:
                    content = response.read().decode('utf-8', errors='ignore')
                    
                # Rewrite playlist URLs
                rewritten = self.rewrite_m3u8(content, url, referer, ua)
                self.send_response(200)
                self.send_header('Content-Type', 'application/vnd.apple.mpegurl')
                self.end_headers()
                self.wfile.write(rewritten.encode('utf-8'))
            except Exception as e:
                self.send_error(500, f"Error fetching m3u8: {e}")
                
        elif path == '/ts':
            url = query.get('url', [None])[0]
            if not url:
                self.send_error(400, "Missing 'url' parameter")
                return
                
            referer = query.get('referer', [None])[0]
            ua = query.get('ua', [None])[0]
            
            req = urllib.request.Request(url)
            if referer:
                req.add_header('Referer', referer)
            if ua:
                req.add_header('User-Agent', ua)
                
            ctx = ssl._create_unverified_context()
            try:
                with urllib.request.urlopen(req, context=ctx) as response:
                    self.send_response(200)
                    self.send_header('Content-Type', 'video/mp2t')
                    self.end_headers()
                    
                    # Buffer the first chunk to detect and strip the header
                    first_chunk = response.read(65536)
                    if first_chunk:
                        start_offset = find_media_start(first_chunk)
                        self.wfile.write(first_chunk[start_offset:])
                        
                    # Stream the rest of the response
                    while True:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            except Exception as e:
                # Connection might be closed by player, which is normal
                pass
                
        else:
            self.send_error(404, "Not Found")

    def rewrite_m3u8(self, content, original_url, referer, ua):
        lines = content.splitlines()
        new_lines = []
        is_playlist_flag = False
        
        for line in lines:
            line_strip = line.strip()
            if not line_strip:
                new_lines.append(line)
                continue
                
            if line_strip.startswith('#'):
                if line_strip.startswith('#EXT-X-STREAM-INF'):
                    is_playlist_flag = True
                
                if 'URI="' in line_strip:
                    parts = line_strip.split('URI="')
                    sub_parts = parts[1].split('"', 1)
                    uri = sub_parts[0]
                    
                    if uri.startswith('http') or not uri.startswith('data:'):
                        absolute_uri = urllib.parse.urljoin(original_url, uri)
                        params = urllib.parse.urlencode({
                            'url': absolute_uri,
                            'referer': referer or '',
                            'ua': ua or ''
                        })
                        proxy_uri = f"http://127.0.0.1:{PORT}/ts?{params}"
                        new_line = parts[0] + 'URI="' + proxy_uri + '"' + sub_parts[1]
                        new_lines.append(new_line)
                    else:
                        new_lines.append(line)
                else:
                    new_lines.append(line)
            else:
                absolute_url = urllib.parse.urljoin(original_url, line_strip)
                params = urllib.parse.urlencode({
                    'url': absolute_url,
                    'referer': referer or '',
                    'ua': ua or ''
                })
                
                url_path = urllib.parse.urlparse(absolute_url).path
                is_playlist = is_playlist_flag or url_path.endswith('.m3u8') or '.m3u8' in url_path
                endpoint = '/m3u8' if is_playlist else '/ts'
                
                # Reset the playlist flag for subsequent lines
                is_playlist_flag = False
                
                proxy_url = f"http://127.0.0.1:{PORT}{endpoint}?{params}"
                new_lines.append(proxy_url)
                
        return "\n".join(new_lines)

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def main():
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), ProxyHandler)
        print(f"[Proxy] Server running on http://127.0.0.1:{PORT}")
        server.serve_forever()
    except OSError as e:
        if e.errno == 98: # Address already in use
            print(f"[Proxy] Port {PORT} already in use. Assuming proxy is already running.")
            sys.exit(0)
        else:
            raise e

if __name__ == '__main__':
    main()
