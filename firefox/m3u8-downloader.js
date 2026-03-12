// ==UserScript==
// @name         M3U8 Video Detector [Auto Sniff]
// @version      1.6.0
// @description  Automatically detect m3u8 videos on the page and download them completely. Detected links appear in the top-right corner. Click download to jump to the downloader. Supports Drag & Drop.
// @icon         https://tools.thatwind.com/favicon.png
// @author       allFull
// @namespace    https://tools.thatwind.com/
// @homepage     https://tools.thatwind.com/tool/m3u8downloader
// @match        *://*/*
// @exclude      *://www.diancigaoshou.com/*
// @require      https://cdn.jsdelivr.net/npm/m3u8-parser@4.7.1/dist/m3u8-parser.min.js
// @connect      *
// @grant        unsafeWindow
// @grant        GM_openInTab
// @grant        GM.openInTab
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM_setValue
// @grant        GM.setValue
// @grant        GM_deleteValue
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_download
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/449581/m3u8%E8%A7%86%E9%A2%91%E4%BE%A6%E6%B5%8B%E4%B8%8B%E8%BD%BD%E5%99%A8%E3%80%90%E8%87%AA%E5%8A%A8%E5%97%85%E6%8E%A2%E3%80%91.user.js
// @updateURL https://update.greasyfork.org/scripts/449581/m3u8%E8%A7%86%E9%A2%91%E4%BE%A6%E6%B5%8B%E4%B8%8B%E8%BD%BD%E5%99%A8%E3%80%90%E8%87%AA%E5%8A%A8%E5%97%85%E6%8E%A2%E3%80%91.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // === Language Configuration (English Only) ===
    const T_langs = {
        "en": {
            play: "Play with Pikpak",
            copy: "Copy Link",
            copied: "Copied",
            download: "Download",
            stop: "Stop",
            downloading: "Downloading",
            multiLine: "Multi",
            mins: "mins"
        }
    };

    // Force English language
    const l = "en";
    const T = T_langs[l] || T_langs["en"];

    // Fix infinite refresh issue in QQ Mail reported by @DostGit
    if (location.host.endsWith('mail.qq.com')) {
        return;
    }

    // === GM API Wrapper ===
    const mgmapi = {
        addStyle(s) {
            let style = document.createElement("style");
            style.innerHTML = s;
            document.documentElement.appendChild(style);
        },
        async getValue(name, defaultVal) {
            return await ((typeof GM_getValue === "function") ? GM_getValue : GM.getValue)(name, defaultVal);
        },
        async setValue(name, value) {
            return await ((typeof GM_setValue === "function") ? GM_setValue : GM.setValue)(name, value);
        },
        async deleteValue(name) {
            return await ((typeof GM_deleteValue === "function") ? GM_deleteValue : GM.deleteValue)(name);
        },
        openInTab(url, open_in_background = false) {
            return ((typeof GM_openInTab === "function") ? GM_openInTab : GM.openInTab)(url, open_in_background);
        },
        xmlHttpRequest(details) {
            return ((typeof GM_xmlhttpRequest === "function") ? GM_xmlhttpRequest : GM.xmlHttpRequest)(details);
        },
        download(details) {
            const self = this;
            const url = details.url;
            const filename = details.name || 'download.mp4';
            // Extract callbacks, provide default empty functions to prevent errors
            const reportProgress = details.reportProgress || function () { };
            const onComplete = details.onComplete || function () { };
            const onError = details.onError || function () { };
            const onStop = details.onStop || function () { };

            // State flags
            let isCancelled = false;
            let currentAbortController = null; // For Strategy 2 (Fetch)
            let currentGmRequest = null;       // For Strategy 3 (GM_xmlhttpRequest)

            // Define cancel function
            const cancel = () => {
                if (isCancelled) return;
                isCancelled = true;
                console.log("User triggered cancel operation.");
                // Abort Fetch request
                if (currentAbortController) {
                    currentAbortController.abort();
                }
                // Abort GM request
                if (currentGmRequest && typeof currentGmRequest.abort === 'function') {
                    currentGmRequest.abort();
                }
                onStop();
            };

            // Internal async execution logic
            (async () => {
                if (isCancelled) return;
                // ============================================================
                // Strategy 1: Same-Origin Check
                // ============================================================
                const currentOrigin = window.location.origin;
                let targetOrigin;
                try {
                    targetOrigin = new URL(url).origin;
                } catch (e) {
                    onError(new Error(`Invalid URL: ${url}`));
                    return;
                }

                if (currentOrigin === targetOrigin) {
                    console.log("Strategy 1: Same-origin detected, using <a> tag download");
                    // Same-origin download usually cannot listen to progress, treat as complete
                    reportProgress(100);
                    triggerAnchorDownload(url, filename);
                    onComplete();
                    return;
                }

                // ============================================================
                // Strategy 2: Try CORS Request + Stream Write (Fetch + FileSystem API)
                // ============================================================
                const supportsFileSystem = typeof unsafeWindow.showSaveFilePicker === 'function';
                let isCorsSupported = false;
                if (supportsFileSystem && !isCancelled) {
                    try {
                        // Detect CORS support
                        currentAbortController = new AbortController();
                        const response = await fetch(url, {
                            method: 'GET',
                            signal: currentAbortController.signal,
                            headers: details.headers || {}
                        });
                        // If response received, CORS is supported (even if 404, network passed)
                        // Note: We abort immediately here, just for detection
                        isCorsSupported = true;
                        currentAbortController.abort();
                        currentAbortController = null; // Reset
                    } catch (error) {
                        if (error.name === 'AbortError') {
                            // If actively aborted, request was sent, CORS supported
                            isCorsSupported = true;
                        } else {
                            console.log("Strategy 2 Detection: Target does not support CORS or network error.", error);
                        }
                    }
                }

                if (isCancelled) return;

                // Execute Strategy 2
                if (supportsFileSystem && isCorsSupported) {
                    console.log("Strategy 2: Supports CORS and FileSystem API, attempting stream download");
                    try {
                        await streamDownload(url, filename, details.headers);
                        return; // Exit if successful
                    } catch (err) {
                        if (isCancelled || err.name === 'AbortError') {
                            console.log("Download cancelled (Strategy 2)");
                            onStop();
                            return;
                        }
                        console.error("Strategy 2 execution failed, falling back to Strategy 3:", err);
                        // Continue to Strategy 3 on failure
                    }
                }

                if (isCancelled) return;

                // ============================================================
                // Strategy 3: GM_xmlhttpRequest (mgmapi) Proxy Download
                // ============================================================
                console.log("Strategy 3: Using GM_xmlhttpRequest download");
                gmDownload(details);
            })();

            // ============================================================
            // Helper Function Definitions (Internal Scope)
            // ============================================================
            function triggerAnchorDownload(blobUrl, name) {
                const element = document.createElement('a');
                element.setAttribute('href', blobUrl);
                element.setAttribute('download', name);
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
                if (blobUrl.startsWith('blob:')) {
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                }
            }

            async function streamDownload(url, name, headers) {
                // 1. Pop up save dialog
                let handle;
                try {
                    handle = await unsafeWindow.showSaveFilePicker({
                        suggestedName: name,
                        types: [{
                            description: 'Video File',
                            accept: { 'video/mp4': ['.mp4'], 'application/octet-stream': ['.bin', '.ts'] }
                        }],
                    });
                } catch (e) {
                    // User cancelled save dialog
                    if (e.name === 'AbortError') throw e;
                    throw new Error("Unable to open file save dialog");
                }
                if (isCancelled) throw new Error('AbortError');

                // 2. Create write stream
                const writable = await handle.createWritable();
                // 3. Initiate real download request
                currentAbortController = new AbortController();
                let response;
                try {
                    response = await fetch(url, {
                        headers: headers || {},
                        signal: currentAbortController.signal
                    });
                } catch (e) {
                    await writable.close(); // Ensure file stream is closed
                    throw e;
                }

                if (!response.body) {
                    await writable.close();
                    throw new Error('ReadableStream not supported.');
                }

                const reader = response.body.getReader();
                const contentLength = +response.headers.get('Content-Length');
                let receivedLength = 0;

                // 4. Read stream and write
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        await writable.write(value);
                        receivedLength += value.length;
                        if (contentLength) {
                            const percent = ((receivedLength / contentLength) * 100).toFixed(2);
                            reportProgress(parseFloat(percent));
                        } else {
                            // When percentage cannot be calculated, log bytes
                            console.log(`[StreamDownload] Downloaded: ${receivedLength} bytes`);
                        }
                    }
                    // Download complete
                    await writable.close();
                    onComplete();
                    // self.message("Download complete (FileSystem API)", 3000);
                } catch (err) {
                    // Try to close stream on error or cancel
                    try { await writable.close(); } catch (e) { }
                    // If cancelled, throw AbortError for upper layer to catch
                    if (err.name === 'AbortError' || isCancelled) {
                        throw new Error('AbortError');
                    }
                    throw err;
                } finally {
                    currentAbortController = null;
                }
            }

            function gmDownload(opt) {
                // Save request object for cancellation
                currentGmRequest = mgmapi.xmlHttpRequest({
                    method: "GET",
                    url: opt.url,
                    responseType: 'blob',
                    headers: opt.headers || {},
                    onload(res) {
                        if (isCancelled) return;
                        if (res.status >= 200 && res.status < 300) {
                            const blob = res.response;
                            const url = URL.createObjectURL(blob);
                            triggerAnchorDownload(url, opt.name);
                            reportProgress(100);
                            onComplete();
                            self.message("Download complete, saving...", 3000);
                        } else {
                            onError(new Error(`Request failed, status code: ${res.status}`));
                            // self.message("Download failed", 3000);
                        }
                    },
                    onprogress(e) {
                        if (isCancelled) return;
                        if (e.lengthComputable && e.total > 0) {
                            const percent = ((e.loaded / e.total) * 100).toFixed(2);
                            reportProgress(parseFloat(percent));
                        }
                    },
                    onerror(err) {
                        if (isCancelled) return;
                        onError(err);
                        // self.message("Network error, download failed", 3000);
                    },
                    onabort() {
                        console.log("GM_Download request aborted");
                    }
                });
            }

            // Return control object immediately
            return { cancel };
        },
        copyText(text) {
            return copyTextToClipboard(text);
            async function copyTextToClipboard(text) {
                // Copy text
                try {
                    await navigator.clipboard.writeText(text);
                } catch (e) {
                    var copyFrom = document.createElement("textarea");
                    copyFrom.textContent = text;
                    document.body.appendChild(copyFrom);
                    copyFrom.select();
                    document.execCommand('copy');
                    copyFrom.blur();
                    document.body.removeChild(copyFrom);
                }
            }
        },
        message(text, disappearTime = 5000) {
            const id = "f8243rd238-gm-message-panel";
            let p = document.querySelector(`#${id}`);
            if (!p) {
                p = document.createElement("div");
                p.id = id;
                p.style = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: end;
                    z-index: 999999999999999;
                `;
                (document.body || document.documentElement).appendChild(p);
            }
            let mdiv = document.createElement("div");
            mdiv.innerText = text;
            mdiv.style = `
                padding: 3px 8px;
                border-radius: 5px;
                background: black;
                box-shadow: #000 1px 2px 5px;
                margin-top: 10px;
                font-size: small;
                color: #fff;
                text-align: right;
            `;
            p.appendChild(mdiv);
            setTimeout(() => {
                p.removeChild(mdiv);
            }, disappearTime);
        },
        waitEle(selector) {
            return new Promise(resolve => {
                while (true) {
                    let ele = document.querySelector(selector);
                    if (ele) {
                        resolve(ele);
                        break;
                    }
                    sleep(200);
                }
            });
        }
    };

    // === Proxy Logic for tools.thatwind.com ===
    if (location.host === "tools.thatwind.com" || location.host === "localhost:3000") {
        mgmapi.addStyle("#userscript-tip{display:none !important;}");
        let hostNeedsProxy = new Set();
        // Proxy requests
        const _fetch = unsafeWindow.fetch;
        unsafeWindow.fetch = async function (...args) {
            let hostname = new URL(args[0]).hostname;
            if (hostNeedsProxy.has(hostname)) {
                return await mgmapiFetch(...args);
            }
            try {
                let response = await _fetch(...args);
                if (response.status !== 200) throw new Error(response.status);
                return response;
            } catch (e) {
                // Use proxy for failed requests
                if (args.length == 1) {
                    console.log(`Domain ${hostname} needs request proxy, url example: ${args[0]}`);
                    hostNeedsProxy.add(hostname);
                    return await mgmapiFetch(...args);
                } else {
                    throw e;
                }
            }
        }

        function mgmapiFetch(...args) {
            return new Promise((resolve, reject) => {
                let referer = new URLSearchParams(location.hash.slice(1)).get("referer");
                let headers = {};
                if (referer) {
                    referer = new URL(referer);
                    headers = {
                        "origin": referer.origin,
                        "referer": referer.href
                    };
                }
                mgmapi.xmlHttpRequest({
                    method: "GET",
                    url: args[0],
                    responseType: 'arraybuffer',
                    headers,
                    onload(r) {
                        resolve({
                            status: r.status,
                            headers: new Headers(r.responseHeaders.split("\n").filter(n => n).map(s => s.split(/:\s*/)).reduce((all, [a, b]) => { all[a] = b; return all; }, {})),
                            async text() {
                                return r.responseText;
                            },
                            async arrayBuffer() {
                                return r.response;
                            }
                        });
                    },
                    onerror() {
                        reject(new Error());
                    }
                });
            });
        }
        return;
    }

    // === iframe Communication ===
    // Currently only used to get top title
    window.addEventListener("message", async (e) => {
        if (e.data === "3j4t9uj349-gm-get-title") {
            let name = `top-title-${Date.now()}`;
            await mgmapi.setValue(name, document.title);
            e.source.postMessage(`3j4t9uj349-gm-top-title-name:${name}`, "*");
        }
    });

    function getTopTitle() {
        return new Promise(resolve => {
            window.addEventListener("message", async function l(e) {
                if (typeof e.data === "string") {
                    if (e.data.startsWith("3j4t9uj349-gm-top-title-name:")) {
                        let name = e.data.slice("3j4t9uj349-gm-top-title-name:".length);
                        await new Promise(r => setTimeout(r, 5)); // Wait 5ms to ensure setValue is written
                        resolve(await mgmapi.getValue(name));
                        mgmapi.deleteValue(name);
                        window.removeEventListener("message", l);
                    }
                }
            });
            window.top.postMessage("3j4t9uj349-gm-get-title", "*");
        });
    }

    // === Interception Logic ===
    {
        const _r_text = unsafeWindow.Response.prototype.text;
        unsafeWindow.Response.prototype.text = function () {
            return new Promise((resolve, reject) => {
                _r_text.call(this).then((text) => {
                    resolve(text);
                    if (checkContent(text)) doM3U({ url: this.url, content: text });
                }).catch(reject);
            });
        }
        const _open = unsafeWindow.XMLHttpRequest.prototype.open;
        unsafeWindow.XMLHttpRequest.prototype.open = function (...args) {
            this.addEventListener("load", () => {
                try {
                    let content = this.responseText;
                    if (checkContent(content)) doM3U({ url: args[1], content });
                } catch { }
            });
            // checkUrl(args[1]);
            return _open.apply(this, args);
        }

        function checkContent(content) {
            if (content.trim().startsWith("#EXTM3U")) {
                return true;
            }
        }
        // Check pure video
        setInterval(doVideos, 1000);
    }

    // === UI Construction ===
    const rootDiv = document.createElement("div");
    rootDiv.style = `
        position: fixed;
        z-index: 9999999999999999;
        opacity: 0.9;
    `;
    rootDiv.style.display = "none";
    document.documentElement.appendChild(rootDiv);
    const shadowDOM = rootDiv.attachShadow({ mode: 'open' });
    const wrapper = document.createElement("div");
    shadowDOM.appendChild(wrapper);

    // Indicator
    const bar = document.createElement("div");
    bar.style = `text-align: right;`;
    bar.innerHTML = `
        <span
        class="number-indicator"
        data-number="0"
        style="
        display: inline-flex;
        width: 25px;
        height: 25px;
        background: black;
        padding: 10px;
        border-radius: 100px;
        margin-bottom: 5px;
        cursor: pointer;
        border: 3px solid #83838382;
        "
        >
        <svg
        style="filter: invert(1);"
        version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 585.913 585.913" style="enable-background:new 0 0 585.913 585.913;" xml:space="preserve">
        <g>
        <path d="M11.173,46.2v492.311l346.22,47.402V535.33c0.776,0.058,1.542,0.109,2.329,0.109h177.39
        c20.75,0,37.627-16.883,37.627-37.627V86.597c0-20.743-16.877-37.628-37.627-37.628h-177.39c-0.781,0-1.553,0.077-2.329,0.124V0
        L11.173,46.2z M110.382,345.888l-1.37-38.273c-0.416-11.998-0.822-26.514-0.822-41.023l-0.415,0.01
        c-2.867,12.767-6.678,26.956-10.187,38.567l-10.961,38.211l-15.567-0.582l-9.239-37.598c-2.801-11.269-5.709-24.905-7.725-37.361
        l-0.25,0.005c-0.503,12.914-0.879,27.657-1.503,39.552L50.84,343.6l-17.385-0.672l5.252-94.208l25.415-0.996l8.499,32.064
        c2.724,11.224,5.467,23.364,7.428,34.819h0.389c2.503-11.291,5.535-24.221,8.454-35.168l9.643-33.042l27.436-1.071l5.237,101.377
        L110.382,345.888z M172.479,349.999c-12.569-0.504-23.013-4.272-28.539-8.142l4.504-17.249c3.939,2.226,13.1,6.445,22.373,6.687
        c12.009,0.32,18.174-5.497,18.174-13.218c0-10.068-9.838-14.683-19.979-14.74l-9.253-0.052v-16.777l8.801-0.066
        c7.708-0.208,17.646-3.262,17.646-11.905c0-6.121-4.914-10.562-14.635-10.331c-7.95,0.189-16.245,3.914-20.213,6.446l-4.52-16.693
        c5.693-4.008,17.224-8.11,29.883-8.588c21.457-0.795,33.643,10.407,33.643,24.625c0,11.029-6.197,19.691-18.738,24.161v0.314
        c12.229,2.216,22.266,11.663,22.266,25.281C213.89,338.188,197.866,351.001,172.479,349.999z M331.104,302.986
        c0,36.126-19.55,52.541-51.193,51.286c-29.318-1.166-46.019-17.103-46.019-52.044v-61.104l25.711-1.006v64.201
        c0,19.191,7.562,29.146,21.179,29.502c14.234,0.368,22.189-8.976,22.189-29.26v-66.125l28.122-1.097v65.647H331.104z
        M359.723,70.476h177.39c8.893,0,16.125,7.236,16.125,16.126v411.22c0,8.888-7.232,16.127-16.125,16.127h-177.39
        c-0.792,0-1.563-0.116-2.329-0.232V380.782c17.685,14.961,40.504,24.032,65.434,24.032c56.037,0,101.607-45.576,101.607-101.599
        c0-56.029-45.581-101.603-101.607-101.603c-24.93,0-47.749,9.069-65.434,24.035V70.728
        C358.159,70.599,358.926,70.476,359.723,70.476z M390.873,364.519V245.241c0-1.07,0.615-2.071,1.586-2.521
        c0.981-0.483,2.13-0.365,2.981,0.307l93.393,59.623c0.666,0.556,1.065,1.376,1.065,2.215c0,0.841-0.399,1.67-1.065,2.215
        l-93.397,59.628c-0.509,0.4-1.114,0.61-1.743,0.61l-1.233-0.289C391.488,366.588,390.873,365.585,390.873,364.519z" />
        </g>
        </svg>
        </span>
    `;
    wrapper.appendChild(bar);

    // Styles (Updated with Drag Cursors)
    const style = document.createElement("style");
    style.innerHTML = `
        .number-indicator{position:relative;}
        .number-indicator::after{
            content: attr(data-number);
            position: absolute;
            bottom: 0;
            right: 0;
            color: #40a9ff;
            font-size: 14px;
            font-weight: bold;
            background: #000;
            border-radius: 10px;
            padding: 3px 5px;
        }
        .copy-link:active{color: #ccc;}
        .download-btn:hover{text-decoration: underline;}
        .download-btn:active{opacity: 0.9;}
        .stop-btn:hover{text-decoration: underline;}
        .stop-btn:active{opacity: 0.9;}
        .m3u8-item{
            color: white;
            margin-bottom: 5px;
            display: flex;
            flex-direction: row;
            background: black;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 14px;
            user-select: none;
            cursor: grab; /* Drag Cursor */
            transition: opacity 0.2s;
        }
        .m3u8-item:active{
            cursor: grabbing; /* Grabbing Cursor */
        }
        .m3u8-item.dragging{
            opacity: 0.5;
        }
        [data-shown="false"] {opacity: 0.8; zoom: 0.8;}
        [data-shown="false"]:hover{opacity: 1;}
        [data-shown="false"] .m3u8-item{display: none;}
    `;
    wrapper.appendChild(style);

    const barBtn = bar.querySelector(".number-indicator");

    // === Visibility and Movement ===
    (async function () {
        let shown = await mgmapi.getValue("shown", true);
        wrapper.setAttribute("data-shown", shown);
        let x = await mgmapi.getValue("x", 10);
        let y = await mgmapi.getValue("y", 10);
        x = Math.min(innerWidth - 50, x);
        y = Math.min(innerHeight - 50, y);
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        rootDiv.style.top = `${y}px`;
        rootDiv.style.right = `${x}px`;

        barBtn.addEventListener("mousedown", e => {
            let startX = e.pageX;
            let startY = e.pageY;
            let moved = false;
            let mousemove = e => {
                let offsetX = e.pageX - startX;
                let offsetY = e.pageY - startY;
                if (moved || (Math.abs(offsetX) + Math.abs(offsetY)) > 5) {
                    moved = true;
                    rootDiv.style.top = `${y + offsetY}px`;
                    rootDiv.style.right = `${x - offsetX}px`;
                }
            };
            let mouseup = e => {
                let offsetX = e.pageX - startX;
                let offsetY = e.pageY - startY;
                if (moved) {
                    x -= offsetX;
                    y += offsetY;
                    mgmapi.setValue("x", x);
                    mgmapi.setValue("y", y);
                } else {
                    shown = !shown;
                    mgmapi.setValue("shown", shown);
                    wrapper.setAttribute("data-shown", shown);
                }
                removeEventListener("mousemove", mousemove);
                removeEventListener("mouseup", mouseup);
            }
            addEventListener("mousemove", mousemove);
            addEventListener("mouseup", mouseup);
        });
    })();

    let count = 0;
    let shownUrls = [];

    // === Video Detection ===
    function doVideos() {
        for (let v of Array.from(document.querySelectorAll("video"))) {
            if (v.duration && v.src && v.src.startsWith("http") && (!shownUrls.includes(v.src))) {
                const src = v.src;
                shownUrls.push(src);
                let { updateDownloadState } = showVideo({
                    type: "video",
                    url: new URL(src),
                    duration: `${Math.ceil(v.duration * 10 / 60) / 10} ${T.mins}`,
                    download() {
                        const details = {
                            url: src,
                            name: (() => {
                                let name = new URL(src).pathname.split("/").slice(-1)[0];
                                if (!/\.\w+$/.test(name)) {
                                    if (name.match(/^\s*$/)) name = Date.now();
                                    name = name + ".mp4";
                                }
                                return name;
                            })(),
                            headers: {
                                origin: location.origin
                            },
                            onError(e) {
                                console.error(e);
                                updateDownloadState({ downloading: false, cancel: null, progress: 0 });
                                mgmapi.openInTab(src);
                                mgmapi.message("Download failed, link opened in new tab", 5000);
                            },
                            reportProgress(progress) {
                                updateDownloadState({ downloading: true, cancel: null, progress });
                            },
                            onComplete() {
                                mgmapi.message("Download complete", 5000);
                                updateDownloadState({ downloading: false, cancel: null, progress: 0 });
                            },
                            onStop() {
                                updateDownloadState({ downloading: false, cancel: null, progress: 0 });
                            }
                        };
                        let { cancel } = mgmapi.download(details);
                        updateDownloadState({ downloading: true, cancel() { cancel(); }, progress: 0 });
                    }
                })
            }
        }
    }

    // === M3U8 Detection ===
    async function doM3U({ url, content }) {
        url = new URL(url);
        if (shownUrls.includes(url.href)) return;
        // Parse m3u8
        content = content || await (await fetch(url)).text();
        const parser = new m3u8Parser.Parser();
        parser.push(content);
        parser.end();
        const manifest = parser.manifest;
        if (manifest.segments) {
            let duration = 0;
            manifest.segments.forEach((segment) => {
                duration += segment.duration;
            });
            manifest.duration = duration;
        }
        showVideo({
            type: "m3u8",
            url,
            duration: manifest.duration ? `${Math.ceil(manifest.duration * 10 / 60) / 10} ${T.mins}` : manifest.playlists ? `${T.multiLine}(${manifest.playlists.length})` : "Unknown",
            async download() {
                mgmapi.openInTab(
                    `https://tools.thatwind.com/tool/m3u8downloader#${new URLSearchParams({
                        m3u8: url.href,
                        referer: location.href,
                        filename: (await getTopTitle()) || ""
                    })}`
                );
            }
        })
    }

    // === UI Item Creation (Refactored with Drag & Drop) ===
    function showVideo({ type, url, duration, download }) {
        let div = document.createElement("div");
        div.className = "m3u8-item";
        div.setAttribute("draggable", "true"); // Enable Drag
        div.dataset.url = url.href; // Store URL for drag

        div.innerHTML = `
            <span ${type == "m3u8" ? "style=\"color:#40a9ff\"" : ""}>${type}</span>
            <span
            title="${url}"
            style="
            color: #ccc;
            font-size: small;
            max-width: 200px;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            margin-left: 10px;
            "
            >${url.pathname}</span>
            <span
            style="
            color: #ccc;
            margin-left: 10px;
            flex-grow: 1;
            "
            >${duration}</span>
            <span
            class="copy-link"
            title="${url}"
            style="
            margin-left: 10px;
            cursor: pointer;
            "
            >${T.copy}</span>
            <span
            class="download-btn"
            style="
            margin-left: 10px;
            cursor: pointer;
            ">${T.download}</span>
            <span>
            <span
            class="progress"
            style="
            display: none;
            margin-left: 10px;
            "
            ></span>
            <span
            class="stop-btn"
            style="
            display: none;
            margin-left: 10px;
            cursor: pointer;
            ">${T.stop}</span>
        `;

        // === Drag & Drop Handlers ===
        div.addEventListener("dragstart", (e) => {
            // Prevent drag if clicking interactive buttons
            if (e.target.closest('.copy-link, .download-btn, .stop-btn')) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData("text/uri-list", url.href);
            e.dataTransfer.setData("text/plain", url.href);
            e.dataTransfer.effectAllowed = "copy";
            div.classList.add("dragging");
        });

        div.addEventListener("dragend", () => {
            div.classList.remove("dragging");
        });

        // === Button Handlers ===
        let cancelDownload;
        let downloadBtn = div.querySelector(".download-btn");
        let stopBtn = div.querySelector(".stop-btn");
        let progressText = div.querySelector(".progress");

        div.querySelector(".copy-link").addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent drag trigger
            mgmapi.copyText(url.href);
            mgmapi.message(T.copied, 2000);
        });

        downloadBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent drag trigger
            download();
        });

        stopBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent drag trigger
            if (cancelDownload) cancelDownload();
        });

        // === Add to UI ===
        rootDiv.style.display = "block";
        count++;
        shownUrls.push(url.href);
        bar.querySelector(".number-indicator").setAttribute("data-number", count);
        wrapper.appendChild(div);

        return {
            updateDownloadState({ downloading, progress, cancel }) {
                if (downloading) {
                    if (cancel) cancelDownload = cancel;
                    downloadBtn.style.display = "none";
                    progressText.style.display = "";
                    progressText.textContent = `${T.downloading} ${progress}%`;
                    stopBtn.style.display = "";
                } else {
                    cancelDownload = null;
                    downloadBtn.style.display = "";
                    progressText.style.display = "none";
                    stopBtn.style.display = "none";
                }
            }
        }
    }

    // === Pikpak Integration ===
    let pikpakLogged = false;
    (async function refreshLogState() {
        pikpakLogged = await mgmapi.getValue("pikpak-logged", false);
        if (!pikpakLogged) {
            setTimeout(refreshLogState, 5000);
        }
    })();

    if (location.host.endsWith("pikpak.com")) {
        const _fetch = unsafeWindow.fetch;
        unsafeWindow.fetch = (...arg) => {
            if (arg[0].includes('area_accessible')) {
                return new Promise(() => {
                    throw new Error();
                });
            } else {
                return _fetch(...arg);
            }
        };
        whenLoad(async () => {
            for (let i = 0; i < 20; i++) {
                if (document.querySelector("a.avatar-box") && document.querySelector("a.avatar-box").clientWidth) {
                    mgmapi.setValue("pikpak-logged", true);
                    break;
                }
                await sleep(1000);
            }
        });
        let link = new URLSearchParams(location.hash.slice(1)).get("link");
        if (link) {
            whenLoad(async () => {
                let input = await mgmapi.waitEle(`.public-page-input input[type="text"]`);
                let button = await mgmapi.waitEle(`.public-page-input button`);
                input.value = link;
                input.dispatchEvent(new Event("input"));
                input.dispatchEvent(new Event("blur"));
                await sleep(100);
                button.click();
            });
        }
    }

    // === Magnet Link Detection & Buttons ===
    const reg = /magnet:\?xt=urn:btih:\w{10,}([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
    whenDOMReady(() => {
        // Styles: Refactored to Button Group style
        mgmapi.addStyle(`
            /* Button group container */
            .wtmzjk-btn-group {
                display: inline-flex;
                align-items: center;
                margin: 2px 8px;
                border-radius: 6px; /* Overall rounded corners */
                overflow: hidden;   /* Ensure children don't overflow corners */
                box-shadow: 0 2px 5px rgba(0,0,0,0.15);
                vertical-align: middle;
                font-size: 12px;
                line-height: 1;
            }
            /* Button general styles */
            .wtmzjk-btn {
                all: initial;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 6px 10px;
                cursor: pointer;
                background: #306eff;; /* Main color, adjustable */
                color: white;
                border: none;
                font-family: sans-serif;
                font-size: inherit;
                font-weight: 600;
                transition: background 0.2s, filter 0.2s;
                text-decoration: none;
                height: 24px;
                box-sizing: border-box;
            }
            .wtmzjk-btn:hover {background: #497dfd;} /* Hover darker */
            .wtmzjk-btn:active {background: #1e5ced;} /* Active even darker */
            /* Icon styles */
            .wtmzjk-btn svg, .wtmzjk-btn img {
                height: 14px;
                width: 14px;
                fill: white;
                pointer-events: none;
                margin-right: 4px; /* Space between icon and text */
            }
            /* Icon-only mode correction */
            .wtmzjk-btn.icon-only svg {margin-right: 0;}
            /* Separator: Implemented via right border */
            .wtmzjk-btn:not(:last-child) {border-right: 1px solid rgba(255, 255, 255, 0.3);}
        `);
        // Event listeners remain unchanged, slight logic adjustment for new structure
        window.addEventListener("click", onEvents, true);
        window.addEventListener("mousedown", onEvents, true); // Usually click is enough if drag not needed
        window.addEventListener("mouseup", onEvents, true);
        watchBodyChange(work);
    });

    function onEvents(e) {
        // Bubble up to prevent failure when clicking icon or span
        const target = e.target.closest('[data-wtmzjk-action]');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            // Trigger only on click to avoid duplicate trigger on mouseup/down
            if (e.type !== "click") return;
            const action = target.getAttribute('data-wtmzjk-action');
            const url = target.getAttribute('data-wtmzjk-url');
            if (action === 'play') {
                let a = document.createElement('a');
                // Keep your original logic
                if (pikpakLogged) {
                    a.href = `https://mypikpak.com/drive/all?action=create_task&url=${encodeURIComponent(url)}&launcher=url_checker&speed_save=1&scene=official_website&invitation-code=86120234`;
                } else {
                    a.href = 'https://mypikpak.com?invitation-code=86120234#' + new URLSearchParams({ link: url });
                }
                a.target = "_blank";
                a.click();
            } else if (action === 'copy') {
                // Implement copy function
                mgmapi.copyText(url).then(() => {
                    // Simple visual feedback
                    const originalText = target.querySelector('span').innerText;
                    target.querySelector('span').innerText = T.copied;
                    setTimeout(() => {
                        target.querySelector('span').innerText = originalText;
                    }, 2000);
                }).catch(err => {
                    console.error('Copy failed', err);
                });
            }
        }
    }

    function createWatchButton(url, isForPlain = false) {
        // Create container
        let group = document.createElement("div");
        group.className = "wtmzjk-btn-group";
        if (isForPlain) group.setAttribute('data-wtmzjk-button-for-plain', '');

        // 1. Copy Button (Left)
        let copyBtn = document.createElement("button");
        copyBtn.className = "wtmzjk-btn";
        copyBtn.setAttribute('data-wtmzjk-action', 'copy');
        copyBtn.setAttribute('data-wtmzjk-url', url);
        copyBtn.title = T.copy;
        // Icon here can be changed to desired Copy icon
        copyBtn.innerHTML = `
            <svg viewBox="0 0 448 512"><path d="M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z"/></svg>
            <span>${T.copy}</span>
        `;

        // 2. Play Button (Right)
        let playBtn = document.createElement("button");
        playBtn.className = "wtmzjk-btn";
        playBtn.setAttribute('data-wtmzjk-action', 'play');
        playBtn.setAttribute('data-wtmzjk-url', url);
        playBtn.title = T.play;
        // Note: This is the custom icon position you requested, src left empty for you to fill
        playBtn.innerHTML = `
            <svg style="width: auto;height: 20px;" width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#FFFFFF" clip-rule="evenodd" fill-rule="evenodd" d="M26.5835 15.2408C27.0625 15.1802 27.4695 14.8617 27.6434 14.4113L29.0836 10.6824C29.2028 10.3737 28.9496 10.0495 28.6213 10.0904L13.4653 11.9768C12.6864 12.0738 12.0192 12.5804 11.7165 13.3045L10.032 17.3354L16.8876 16.4679L26.5835 15.2408ZM33.4485 15.2408C32.9695 15.1802 32.5625 14.8617 32.3885 14.4113L30.9484 10.6824C30.8292 10.3737 31.0824 10.0495 31.4107 10.0904L46.5667 11.9768C47.3455 12.0738 48.0128 12.5804 48.3154 13.3045L50 17.3354L33.4485 15.2408ZM10 17.336H50V39.3048C50 41.7755 47.9971 43.7784 45.5263 43.7784H14.4737C12.0029 43.7784 10 41.7755 10 39.3048V17.336ZM22.889 24.2091C23.8772 24.2091 24.6784 25.0102 24.6784 25.9985V29.5541C24.6784 30.5424 23.8772 31.3435 22.889 31.3435C21.9007 31.3435 21.0995 30.5424 21.0995 29.5541V25.9985C21.0995 25.0102 21.9007 24.2091 22.889 24.2091ZM38.9006 25.9985C38.9006 25.0102 38.0994 24.2091 37.1111 24.2091C36.1228 24.2091 35.3217 25.0102 35.3217 25.9985V29.5541C35.3217 30.5424 36.1228 31.3435 37.1111 31.3435C38.0994 31.3435 38.9006 30.5424 38.9006 29.5541V25.9985ZM35.4241 36.7358C35.6534 37.314 35.3706 37.9687 34.7924 38.198L34.615 37.7507C34.6956 37.954 34.7923 38.1981 34.792 38.1982L34.7906 38.1987L34.788 38.1998L34.7803 38.2028L34.7552 38.2125C34.7343 38.2205 34.705 38.2316 34.668 38.2454C34.5939 38.2728 34.4885 38.3108 34.3562 38.3558C34.0921 38.4457 33.7183 38.5645 33.2711 38.683C32.3873 38.9173 31.1692 39.1638 29.9243 39.1638C28.6786 39.1638 27.4701 38.9171 26.5947 38.6821C26.152 38.5633 25.7828 38.4443 25.522 38.354C25.3913 38.3089 25.2872 38.2707 25.2141 38.2431C25.1774 38.2293 25.1485 38.2181 25.1278 38.21L25.1029 38.2002L25.0952 38.1971L25.0925 38.1961L25.0911 38.1955C25.0908 38.1954 25.3266 37.6115 25.3889 37.4575L25.0907 38.1953C24.514 37.9623 24.2354 37.3058 24.4685 36.7291C24.7014 36.1528 25.3571 35.8742 25.9335 36.1063L25.9352 36.107L25.948 36.1121C25.9605 36.1169 25.9808 36.1248 26.0085 36.1353C26.064 36.1561 26.1486 36.1872 26.2582 36.2252C26.478 36.3011 26.7958 36.4037 27.1787 36.5065C27.9545 36.7148 28.9518 36.9112 29.9243 36.9112C30.8975 36.9112 31.9059 36.7145 32.6939 36.5056C33.0826 36.4026 33.4062 36.2997 33.6304 36.2234C33.7423 36.1853 33.8288 36.154 33.8856 36.133C33.9139 36.1225 33.9349 36.1145 33.9478 36.1096L33.961 36.1045L33.9618 36.1041L33.9622 36.104L33.9624 36.1039L33.9628 36.1038C34.5408 35.8752 35.1949 36.158 35.4241 36.7358Z" />
            </svg>
            <span>${T.play}</span>
        `;
        group.appendChild(copyBtn);
        group.appendChild(playBtn);
        return group;
    }

    function hasPlainMagUrlThatNotHandled() {
        let m = document.body.textContent.match(new RegExp(reg, 'g'));
        return document.querySelectorAll(`[data-wtmzjk-button-for-plain]`).length != (m ? m.length : 0);
    }

    function work() {
        if (!document.body) return;
        if (hasPlainMagUrlThatNotHandled()) {
            for (let node of getAllTextNodes(document.body)) {
                if (node.nextSibling && node.nextSibling.hasAttribute && node.nextSibling.className.includes('wtmzjk-btn-group')) continue;
                let text = node.nodeValue;
                if (!reg.test(text)) continue;
                let match = text.match(reg);
                if (match) {
                    let url = match[0];
                    let p = node.parentNode;
                    p.insertBefore(document.createTextNode(text.slice(0, match.index + url.length)), node);
                    p.insertBefore(createWatchButton(url, true), node);
                    p.insertBefore(document.createTextNode(text.slice(match.index + url.length)), node);
                    p.removeChild(node);
                }
            }
        }
        for (let a of Array.from(document.querySelectorAll(
            ['href', 'value', 'data-clipboard-text', 'data-value', 'title', 'alt', 'data-url', 'data-magnet', 'data-copy'].map(n => `[${n}*="magnet:?xt=urn:btih:"]`).join(',')
        ))) {
            if (a.nextSibling && a.nextSibling.hasAttribute && a.nextSibling.className.includes('wtmzjk-btn-group')) continue; // Already added
            if (reg.test(a.textContent)) continue;
            for (let attr of a.getAttributeNames()) {
                let val = a.getAttribute(attr);
                if (!reg.test(val)) continue;
                let url = val.match(reg)[0];
                a.parentNode.insertBefore(createWatchButton(url), a.nextSibling);
            }
        }
    }

    function watchBodyChange(onchange) {
        let timeout;
        let observer = new MutationObserver(() => {
            if (!timeout) {
                timeout = setTimeout(() => {
                    timeout = null;
                    onchange();
                }, 200);
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
    }

    function getAllTextNodes(parent) {
        var re = [];
        if (["STYLE", "SCRIPT", "BASE", "COMMAND", "LINK", "META", "TITLE", "XTRANS-TXT", "XTRANS-TXT-GROUP", "XTRANS-POPUP"].includes(parent.tagName)) return re;
        for (let node of parent.childNodes) {
            if (node.childNodes.length) re = re.concat(getAllTextNodes(node));
            else if (Text.prototype.isPrototypeOf(node) && (!node.nodeValue.match(/^\s*$/))) re.push(node);
        }
        return re;
    }

    function whenDOMReady(f) {
        if (document.body) f();
        else window.addEventListener("DOMContentLoaded", function l() {
            window.removeEventListener("DOMContentLoaded", l);
            f();
        });
    }

    function whenLoad(f) {
        if (document.body) f();
        else window.addEventListener("load", function l() {
            window.removeEventListener("load", l);
            f();
        });
    }

    function sleep(t) {
        return new Promise(resolve => setTimeout(resolve, t));
    }
})();
