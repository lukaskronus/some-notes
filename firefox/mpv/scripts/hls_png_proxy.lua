-- hls_png_proxy.lua
-- Native Windows (and cross-platform) HLS PNG-header bypass for mpv.
-- Starts a single Go binary proxy and guarantees it is killed when mpv exits.
-- No Python / Node / external runtime required.

local utils = require 'mp.utils'
local msg   = require 'mp.msg'

local PORT   = 12082
local inited = false
local proxy_pid = nil   -- process handle / pid of the proxy

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

-- Start the native proxy (only once)
local function start_proxy_server()
    if inited then return end

    local proxy_bin = get_proxy_path()
    local platform = mp.get_property_native("platform")

    -- On Windows, prefer the .exe; fall back to PATH only if missing
    if platform == "windows" then
        local f = io.open(proxy_bin, "rb")
        if not f then
            msg.error("Native proxy binary not found: " .. proxy_bin)
            msg.error("Place hls_png_proxy.exe next to this Lua script.")
            return
        end
        f:close()
    end

    msg.info("Starting native HLS PNG Proxy (" .. proxy_bin .. ") ...")

    -- MUST be async. A blocking command_native would freeze the on_load hook
    -- forever (the proxy never exits), so the m3u8 URL would never be rewritten.
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

    inited = true
    msg.info("Proxy started (will be killed automatically when mpv exits)")
end

-- Explicit cleanup on shutdown (extra safety on Windows)
local function cleanup()
    if not inited then return end
    msg.info("mpv exiting – native proxy will be terminated by the player")
    -- No need to kill manually: non-detached subprocess is reaped by mpv.
    -- Leaving an explicit note for debugging.
    inited = false
end

mp.register_event("shutdown", cleanup)

-- Intercept m3u8 streams and redirect them through the local proxy
mp.add_hook("on_load", 30, function()
    start_proxy_server()

    local url = mp.get_property("stream-open-filename", "")
    if not url or url == "" then return end

    -- Only proxy external HTTP(S) HLS playlists, never the local proxy itself
    if url:find("^https?://")
        and (url:find("%.m3u8") or url:find("index%-playlist") or url:find("/m3u8"))
        and not url:find("127%.0%.0%.1")
        and not url:find("localhost")
    then
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
