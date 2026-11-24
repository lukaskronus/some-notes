package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

const PORT = "12082"

// Matches URI="..." or URI='...'
var uriRegex = regexp.MustCompile(`URI=(?:"([^"]+)"|'([^']+)')`)

func findTSStart(data []byte) int {
	n := len(data)
	if n < 188 {
		return -1
	}
	limit := n - 188*3
	if limit > 8192 {
		limit = 8192
	}
	for i := 0; i < limit; i++ {
		if data[i] == 0x47 {
			isTS := true
			for j := 1; j < 4; j++ {
				if data[i+j*188] != 0x47 {
					isTS = false
					break
				}
			}
			if isTS {
				return i
			}
		}
	}
	return -1
}

func findMediaStart(data []byte) int {
	tsIdx := findTSStart(data)
	if tsIdx != -1 {
		return tsIdx
	}
	n := len(data)
	limit := n - 8
	if limit > 8192 {
		limit = 8192
	}
	for i := 0; i < limit; i++ {
		if i+8 <= n {
			box := string(data[i+4 : i+8])
			if box == "ftyp" || box == "moof" || box == "mdat" {
				return i
			}
		}
	}
	return 0
}

func rewriteM3U8(content, originalURL, referer, ua string) string {
	lines := strings.Split(content, "\n")
	var newLines []string
	baseURL, _ := url.Parse(originalURL)

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			newLines = append(newLines, line)
			continue
		}

		match := uriRegex.FindStringSubmatchIndex(trimmed)
		if match != nil {
			var uri string
			if match[2] != -1 {
				uri = trimmed[match[2]:match[3]] // Double quotes
			} else {
				uri = trimmed[match[4]:match[5]] // Single quotes
			}

			if !strings.HasPrefix(uri, "data:") {
				absURI, _ := url.Parse(uri)
				absoluteURI := baseURL.ResolveReference(absURI).String()
				endpoint := "/ts"
				if strings.Contains(strings.ToLower(absoluteURI), ".m3u8") {
					endpoint = "/m3u8"
				}

				q := url.Values{}
				q.Set("url", absoluteURI)
				q.Set("referer", referer)
				q.Set("ua", ua)

				proxyURI := fmt.Sprintf("http://127.0.0.1:%s%s?%s", PORT, endpoint, q.Encode())
				prefix := trimmed[:match[0]]
				suffix := trimmed[match[1]:]
				newLines = append(newLines, fmt.Sprintf(`%sURI="%s"%s`, prefix, proxyURI, suffix))
				continue
			}
		}

		// Handle bare URLs (lines without tags)
		if strings.HasPrefix(trimmed, "http") || (!strings.HasPrefix(trimmed, "#") && trimmed != "") {
			absURL, _ := url.Parse(trimmed)
			absoluteURL := baseURL.ResolveReference(absURL).String()
			endpoint := "/ts"
			if strings.Contains(strings.ToLower(absoluteURL), ".m3u8") {
				endpoint = "/m3u8"
			}
			q := url.Values{}
			q.Set("url", absoluteURL)
			q.Set("referer", referer)
			q.Set("ua", ua)
			newLines = append(newLines, fmt.Sprintf("http://127.0.0.1:%s%s?%s", PORT, endpoint, q.Encode()))
		} else {
			newLines = append(newLines, line)
		}
	}
	return strings.Join(newLines, "\n")
}

func main() {
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	http.HandleFunc("/play", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/m3u8", func(w http.ResponseWriter, r *http.Request) {
		targetURL := r.URL.Query().Get("url")
		if targetURL == "" {
			http.Error(w, "Missing 'url' parameter", http.StatusBadRequest)
			return
		}
		referer := r.URL.Query().Get("referer")
		ua := r.URL.Query().Get("ua")

		req, _ := http.NewRequest("GET", targetURL, nil)
		if referer != "" {
			req.Header.Set("Referer", referer)
		}
		if ua != "" {
			req.Header.Set("User-Agent", ua)
		}

		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		content, _ := io.ReadAll(resp.Body)
		rewritten := rewriteM3U8(string(content), targetURL, referer, ua)

		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Write([]byte(rewritten))
	})

	http.HandleFunc("/ts", func(w http.ResponseWriter, r *http.Request) {
		targetURL := r.URL.Query().Get("url")
		if targetURL == "" {
			http.Error(w, "Missing 'url' parameter", http.StatusBadRequest)
			return
		}
		referer := r.URL.Query().Get("referer")
		ua := r.URL.Query().Get("ua")

		req, _ := http.NewRequest("GET", targetURL, nil)
		if referer != "" {
			req.Header.Set("Referer", referer)
		}
		if ua != "" {
			req.Header.Set("User-Agent", ua)
		}

		resp, err := client.Do(req)
		if err != nil {
			return // Silent fail for player disconnects
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "video/MP2T")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)

		firstChunk := make([]byte, 65536)
		n, err := resp.Body.Read(firstChunk)
		if n > 0 {
			offset := findMediaStart(firstChunk[:n])
			if offset > 0 {
				w.Write(firstChunk[offset:n])
			} else {
				w.Write(firstChunk[:n])
			}
		}

		if err == nil {
			io.Copy(w, resp.Body)
		}
	})

	fmt.Printf("[Proxy] Server running on http://127.0.0.1:%s\n", PORT)
	log.Fatal(http.ListenAndServe("127.0.0.1:"+PORT, nil))
}
