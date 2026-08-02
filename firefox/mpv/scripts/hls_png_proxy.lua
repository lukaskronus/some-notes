-- hls_png_proxy.lua
-- Native Windows / Linux HLS PNG-header bypass for mpv.
-- Starts a single Go binary proxy and guarantees it is killed when mpv exits.
-- No Python / Node / external runtime required.

local utils = require 'mp.utils'
local msg   = require 'mp.msg'

local PORT   = 12082
local inited = false

-- URL-encode helper
local function urlencode(str)
    if not str then return "" end
    str = str:gsub("\n", "\r")
    str = str:gsub("([^%w %-%_%.%~])", function(c)
        return string.format("%%%02X", string.byte(c))
    end)
    str = str:gsub(" ", "+")
    return str
end

-- Extract Referer from http-header-fields
local function get_referer()
    local headers = mp.get_property("http-header-fields", "")
    if not headers or headers == "" then return "" end
    local referer = headers:match("[Rr]eferer:%s*([^,;\r\n]+)")
    return referer or ""
end

-- Resolve path to the native proxy binary next to this script
local function get_proxy_path()
    local script_dir = mp.get_script_directory()
    if not script_dir or script_dir == "" then
        script_dir = mp.command_native({"expand-path", "~~/scripts/"})
    end

    local platform = mp.get_property_native("platform")
    local name = "hls_png_proxy"
    if platform == "windows" then
        name = name .. ".exe"
    end
    return utils.join_path(script_dir, name)
end

-- Portable short sleep (busy-wait, fine for < 500 ms)
local function sleep(seconds)
    local t0 = mp.get_time()
    while mp.get_time() - t0 < seconds do end
end

-- Check whether the proxy is already listening on the port.
-- Uses a quick HTTP request to the built-in /play endpoint.
local function is_proxy_ready()
    local res = mp.command_native({
        name = "subprocess",
        playback_only = false,
        capture_stdout = true,
        capture_stderr = true,
        args = {
            "curl", "-s", "--connect-timeout", "0.3", "--max-time", "0.5",
            "http://127.0.0.1:" .. PORT .. "/play?url=test"
        },
    })
    if res and res.status == 0 and res.stdout and res.stdout:find("OK") then
        return true
    end
    return false
end

-- Start the native proxy (only when needed)
local function start_proxy_server()
    -- Already running and responding?
    if inited and is_proxy_ready() then
        return true
    end

    local proxy_bin = get_proxy_path()
    local platform = mp.get_property_native("platform")

    -- Check that the binary actually exists
    local f = io.open(proxy_bin, "rb")
    if not f then
        msg.error("Native proxy binary not found: " .. proxy_bin)
        if platform == "windows" then
            msg.error("Place hls_png_proxy.exe next to this Lua script.")
        else
            msg.error("Place the 'hls_png_proxy' binary next to this Lua script")
            msg.error("and run: chmod +x " .. proxy_bin)
        end
        return false
    end
    f:close()

    msg.info("Starting native HLS PNG Proxy (" .. proxy_bin .. ") ...")

    -- MUST be async. A blocking command_native would freeze the on_load hook
    -- forever (the proxy never exits).
    --
    -- Important: do NOT set detach = true.
    -- mpv guarantees a non-detached subprocess is terminated when the player
    -- exits, even with playback_only = false. This prevents zombie proxies.
    mp.command_native_async({
        name = "subprocess",
        playback_only = false,   -- keep alive across playlist items
        detach = false,          -- CRITICAL: die with mpv
        capture_stdout = false,
        capture_stderr = false,
        args = { proxy_bin, tostring(PORT) },
    })

    -- Wait until the proxy is actually accepting connections (up to ~1.5 s)
    for i = 1, 15 do
        sleep(0.1)
        if is_proxy_ready() then
            inited = true
            msg.info("Proxy is ready on port " .. PORT)
            return true
        end
    end

    msg.error("Proxy failed to become ready on port " .. PORT)
    msg.error("Make sure the binary is executable and not blocked by a firewall.")
    return false
end

-- Explicit cleanup on shutdown
local function cleanup()
    if not inited then return end
    msg.info("mpv exiting – native proxy will be terminated by the player")
    inited = false
end

mp.register_event("shutdown", cleanup)

-- Intercept m3u8 streams and redirect them through the local proxy
mp.add_hook("on_load", 30, function()
    local url = mp.get_property("stream-open-filename", "")
    if not url or url == "" then return end

    -- Only proxy external HTTP(S) HLS playlists, never the local proxy itself
    if url:find("^https?://")
        and (url:find("%.m3u8") or url:find("index%-playlist") or url:find("/m3u8"))
        and not url:find("127%.0%.0%.1")
        and not url:find("localhost")
    then
        -- Start (or ensure) the proxy is running ONLY when we actually need it
        if not start_proxy_server() then
            msg.error("Cannot start HLS PNG proxy – playing original URL (may fail)")
            return
        end

        local referer = get_referer()
        local ua      = mp.get_property("user-agent", "")

        msg.info("Intercepted HLS URL for PNG Bypass: " .. url)
        if referer ~= "" then
            msg.info("Using Referer: " .. referer)
        end

        -- Clear any previous http-proxy that might interfere with localhost
        local current_proxy = mp.get_property("http-proxy", "")
        if current_proxy and current_proxy:find("12081") then
            msg.info("Clearing http-proxy to avoid routing local requests through YouTube proxy")
            mp.set_property("http-proxy", "")
        end

        local proxy_url = string.format(
            "http://127.0.0.1:%d/m3u8?url=%s&referer=%s&ua=%s",
            PORT,
            urlencode(url),
            urlencode(referer),
            urlencode(ua)
        )

        mp.set_property("stream-open-filename", proxy_url)
    end
end)
