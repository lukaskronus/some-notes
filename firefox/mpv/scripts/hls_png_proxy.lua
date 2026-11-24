-- hls_png_proxy.lua
-- Dual-layer interception: catches the playlist, and catches stray segments as a fallback.

local utils = require 'mp.utils'
local msg   = require 'mp.msg'

local PORT = 12082
local proxy_state = "stopped"

local function urlencode(str)
    if not str then return "" end
    str = str:gsub("\n", "\r\n")
    str = str:gsub("([^%w %-%_%.%~])", function(c)
        return string.format("%%%02X", string.byte(c))
    end)
    str = str:gsub(" ", "+")
    return str
end

local function get_referer()
    local headers = mp.get_property("http-header-fields", "")
    if not headers or headers == "" then return "" end
    return headers:match("[Rr]eferer:%s*([^,;\r\n]+)") or ""
end

local function get_proxy_path()
    local script_dir = mp.get_script_directory()
    if not script_dir or script_dir == "" then
        script_dir = mp.command_native({"expand-path", "~~/scripts/"})
    end
    local platform = mp.get_property_native("platform")
    local name = (platform == "windows") and "hls_png_proxy.exe" or "hls_png_proxy"
    return utils.join_path(script_dir, name)
end

local function sleep(seconds)
    local t0 = mp.get_time()
    while mp.get_time() - t0 < seconds do end
end

local function ensure_proxy()
    if proxy_state == "ready" then return true end
    
    if proxy_state == "starting" then
        for i = 1, 5 do
            sleep(0.05)
            if proxy_state == "ready" then return true end
        end
        return false
    end

    proxy_state = "starting"
    local proxy_bin = get_proxy_path()

    local f = io.open(proxy_bin, "rb")
    if not f then
        msg.error("Native proxy binary not found: " .. proxy_bin)
        proxy_state = "stopped"
        return false
    end
    f:close()

    msg.info("Starting native HLS PNG Proxy on port " .. PORT .. "...")
    
    mp.command_native_async({
        name = "subprocess",
        playback_only = false,
        detach = false,
        capture_stdout = false,
        capture_stderr = false,
        args = { proxy_bin, tostring(PORT) },
    })

    sleep(0.2)
    proxy_state = "ready"
    msg.info("Proxy is ready.")
    return true
end

local function cleanup()
    if proxy_state ~= "stopped" then
        msg.info("mpv exiting – native proxy will be terminated")
    end
    proxy_state = "stopped"
end

mp.register_event("shutdown", cleanup)

mp.add_hook("on_load", 10, function()
    local url = mp.get_property("stream-open-filename", "")
    if not url or url == "" then return end

    local lower_url = url:lower()
    local is_external = url:find("^https?://") and not url:find("127%.0%.0%.1") and not url:find("localhost")

    if not is_external then return end

    local endpoint = nil
    
    -- Layer 1: Intercept the playlist
    if lower_url:find("%.m3u8") or lower_url:find("%.m3u") or lower_url:find("playlist") then
        endpoint = "m3u8"
    -- Layer 2: Fallback intercept for disguised segments (if proxy rewrite missed one)
    elseif lower_url:find("%.png") or lower_url:find("%.jpg") or lower_url:find("%.jpeg") or lower_url:find("%.webp") or lower_url:find("%.ts") then
        endpoint = "ts"
    end

    if endpoint then
        if not ensure_proxy() then
            msg.error("Cannot start proxy. Falling back to original URL.")
            return
        end

        local referer = get_referer()
        local ua      = mp.get_property("user-agent", "")

        msg.info("Intercepted " .. endpoint .. " for PNG Bypass: " .. url)
        
        local proxy_url = string.format(
            "http://127.0.0.1:%d/%s?url=%s&referer=%s&ua=%s",
            PORT,
            endpoint,
            urlencode(url),
            urlencode(referer),
            urlencode(ua)
        )

        mp.set_property("stream-open-filename", proxy_url)
    end
end)
