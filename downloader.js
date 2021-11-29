! function() {
    "use strict";
    const e = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 7, 7, 10, 9, 9, 9, 11, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 24, 36, 48, 60, 72, 84, 96, 0, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 24, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 127, 63, 63, 63, 0, 31, 15, 15, 15, 7, 7, 7];

    function t(t) {
        var n = t.indexOf("%");
        if (-1 === n) return t;
        for (var i = t.length, l = "", o = 0, s = 0, a = n, u = 12; n > -1 && n < i;) {
            var h = r(t[n + 1], 4) | r(t[n + 2], 0),
                d = e[h];
            if (s = s << 6 | h & e[364 + d], 12 !== (u = e[256 + u + d])) {
                if (0 === u) return null;
                if ((n += 3) < i && 37 === t.charCodeAt(n)) continue;
                return null
            }
            l += t.slice(o, a), l += s <= 65535 ? String.fromCharCode(s) : String.fromCharCode(55232 + (s >> 10), 56320 + (1023 & s)), s = 0, o = n + 3, n = a = t.indexOf("%", o)
        }
        return l + t.slice(o)
    }
    const n = {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 7,
        8: 8,
        9: 9,
        a: 10,
        A: 10,
        b: 11,
        B: 11,
        c: 12,
        C: 12,
        d: 13,
        D: 13,
        e: 14,
        E: 14,
        f: 15,
        F: 15
    };

    function r(e, t) {
        var r = n[e];
        return void 0 === r ? 255 : r << t
    }
    class i {
        constructor(e) {
            const t = e ?? Object.create(null);
            this.ACL = t.ACL ?? null, this.BIND = t.BIND ?? null, this.CHECKOUT = t.CHECKOUT ?? null, this.CONNECT = t.CONNECT ?? null, this.COPY = t.COPY ?? null, this.DELETE = t.DELETE ?? null, this.GET = t.GET ?? null, this.HEAD = t.HEAD ?? null, this.LINK = t.LINK ?? null, this.LOCK = t.LOCK ?? null, this["M-SEARCH"] = t["M-SEARCH"] ?? null, this.MERGE = t.MERGE ?? null, this.MKACTIVITY = t.MKACTIVITY ?? null, this.MKCALENDAR = t.MKCALENDAR ?? null, this.MKCOL = t.MKCOL ?? null, this.MOVE = t.MOVE ?? null, this.NOTIFY = t.NOTIFY ?? null, this.OPTIONS = t.OPTIONS ?? null, this.PATCH = t.PATCH ?? null, this.POST = t.POST ?? null, this.PROPFIND = t.PROPFIND ?? null, this.PROPPATCH = t.PROPPATCH ?? null, this.PURGE = t.PURGE ?? null, this.PUT = t.PUT ?? null, this.REBIND = t.REBIND ?? null, this.REPORT = t.REPORT ?? null, this.SEARCH = t.SEARCH ?? null, this.SOURCE = t.SOURCE ?? null, this.SUBSCRIBE = t.SUBSCRIBE ?? null, this.TRACE = t.TRACE ?? null, this.UNBIND = t.UNBIND ?? null, this.UNLINK = t.UNLINK ?? null, this.UNLOCK = t.UNLOCK ?? null, this.UNSUBSCRIBE = t.UNSUBSCRIBE ?? null
        }
    }
    const l = {
        STATIC: 0,
        PARAM: 1,
        MATCH_ALL: 2,
        REGEX: 3,
        MULTI_PARAM: 4
    };

    function o(e) {
        e = e || {}, this.prefix = e.prefix || "/", this.label = this.prefix[0], this.children = e.children || {}, this.numberOfChildren = Object.keys(this.children).length, this.kind = e.kind || this.types.STATIC, this.handlers = new i(e.handlers), this.regex = e.regex || null, this.wildcardChild = null, this.parametricBrother = null, this.versions = e.versions
    }
    Object.defineProperty(o.prototype, "types", {
        value: l
    }), o.prototype.getLabel = function() {
        return this.prefix[0]
    }, o.prototype.addChild = function(e) {
        var t = "";
        switch (e.kind) {
            case this.types.STATIC:
                t = e.getLabel();
                break;
            case this.types.PARAM:
            case this.types.REGEX:
            case this.types.MULTI_PARAM:
                t = ":";
                break;
            case this.types.MATCH_ALL:
                this.wildcardChild = e, t = "*";
                break;
            default:
                throw new Error(`Unknown node kind: ${e.kind}`)
        }
        if (null != this.children[t]) throw new Error(`There is already a child with label '${t}'`);
        this.children[t] = e, this.numberOfChildren = Object.keys(this.children).length;
        const n = Object.keys(this.children);
        for (var r = this.parametricBrother, i = 0; i < n.length; i++) {
            const e = this.children[n[i]];
            if (":" === e.label) {
                r = e;
                break
            }
        }
        const l = e => {
            if (!e) return;
            if (e.kind !== this.types.STATIC) return;
            e !== this && (e.parametricBrother = r || e.parametricBrother);
            const t = Object.keys(e.children);
            for (var n = 0; n < t.length; n++) l(e.children[t[n]])
        };
        return l(this), this
    }, o.prototype.reset = function(e, t) {
        return this.prefix = e, this.children = {}, this.kind = this.types.STATIC, this.handlers = new i, this.numberOfChildren = 0, this.regex = null, this.wildcardChild = null, this.versions = t, this
    }, o.prototype.findByLabel = function(e) {
        return this.children[e[0]]
    }, o.prototype.findChild = function(e, t) {
        var n = this.children[e[0]];
        return void 0 !== n && (n.numberOfChildren > 0 || null !== n.handlers[t]) && e.slice(0, n.prefix.length) === n.prefix || void 0 !== (n = this.children[":"]) && (n.numberOfChildren > 0 || null !== n.handlers[t]) || void 0 !== (n = this.children["*"]) && (n.numberOfChildren > 0 || null !== n.handlers[t]) ? n : null
    }, o.prototype.findVersionChild = function(e, t, n) {
        var r = this.children[t[0]];
        return void 0 !== r && (r.numberOfChildren > 0 || null !== r.getVersionHandler(e, n)) && t.slice(0, r.prefix.length) === r.prefix || void 0 !== (r = this.children[":"]) && (r.numberOfChildren > 0 || null !== r.getVersionHandler(e, n)) || void 0 !== (r = this.children["*"]) && (r.numberOfChildren > 0 || null !== r.getVersionHandler(e, n)) ? r : null
    }, o.prototype.setHandler = function(e, t, n, r) {
        if (t) {
            if (null != this.handlers[e]) throw new Error(`There is already an handler with method '${e}'`);
            this.handlers[e] = {
                handler: t,
                params: n,
                store: r || null,
                paramsLength: n.length
            }
        }
    }, o.prototype.setVersionHandler = function(e, t, n, r, l) {
        if (!n) return;
        const o = this.versions.get(e) || new i;
        if (null != o[t]) throw new Error(`There is already an handler with version '${e}' and method '${t}'`);
        o[t] = {
            handler: n,
            params: r,
            store: l || null,
            paramsLength: r.length
        }, this.versions.set(e, o)
    }, o.prototype.getHandler = function(e) {
        return this.handlers[e]
    }, o.prototype.getVersionHandler = function(e, t) {
        var n = this.versions.get(e);
        return null === n ? n : n[t]
    }, o.prototype.prettyPrint = function(e, t) {
        var n = "",
            r = this.handlers || {},
            i = Object.keys(r).filter((e => r[e] && r[e].handler));
        ":" === this.prefix ? i.forEach(((t, r) => {
            var l = this.handlers[t].params,
                o = l[l.length - 1];
            if (i.length > 1) {
                if (0 === r) return void(n += o + ` (${t})\n`);
                n += e + "    :" + o + ` (${t})`, n += r === i.length - 1 ? "" : "\n"
            } else n = l[l.length - 1] + ` (${t})`
        })) : i.length && (n = ` (${i.join("|")})`);
        var l = `${e}${t?"└── ":"├── "}${this.prefix}${n}\n`;
        e = `${e}${t?"    ":"│   "}`;
        const o = Object.keys(this.children);
        for (var s = 0; s < o.length - 1; s++) l += this.children[o[s]].prettyPrint(e, !1);
        return o.length > 0 && (l += this.children[o[o.length - 1]].prettyPrint(e, !0)), l
    };
    const s = ["ACL", "BIND", "CHECKOUT", "CONNECT", "COPY", "DELETE", "GET", "HEAD", "LINK", "LOCK", "M-SEARCH", "MERGE", "MKACTIVITY", "MKCALENDAR", "MKCOL", "MOVE", "NOTIFY", "OPTIONS", "PATCH", "POST", "PROPFIND", "PROPPATCH", "PURGE", "PUT", "REBIND", "REPORT", "SEARCH", "SOURCE", "SUBSCRIBE", "TRACE", "UNBIND", "UNLINK", "UNLOCK", "UNSUBSCRIBE"];
    var a = "object" == typeof global && global && global.Object === Object && global,
        u = "object" == typeof self && self && self.Object === Object && self,
        h = (a || u || Function("return this")()).Symbol,
        d = Object.prototype,
        c = d.hasOwnProperty,
        f = d.toString,
        p = h ? h.toStringTag : void 0;
    var m = Object.prototype.toString;
    var b = h ? h.toStringTag : void 0;

    function g(e) {
        return null == e ? void 0 === e ? "[object Undefined]" : "[object Null]" : b && b in Object(e) ? function(e) {
            var t = c.call(e, p),
                n = e[p];
            try {
                e[p] = void 0;
                var r = !0
            } catch (e) {}
            var i = f.call(e);
            return r && (t ? e[p] = n : delete e[p]), i
        }(e) : function(e) {
            return m.call(e)
        }(e)
    }

    function w(e) {
        return "symbol" == typeof e || function(e) {
            return null != e && "object" == typeof e
        }(e) && "[object Symbol]" == g(e)
    }

    function y(e) {
        return e
    }

    function v(e, t) {
        return e > t
    }

    function C(e) {
        return e && e.length ? function(e, t, n) {
            for (var r = -1, i = e.length; ++r < i;) {
                var l = e[r],
                    o = t(l);
                if (null != o && (void 0 === s ? o == o && !w(o) : n(o, s))) var s = o,
                    a = l
            }
            return a
        }(e, y, v) : void 0
    }
    class x {
        constructor(e, t, n) {
            this.prefix = Number(e) || 0, this.children = t ?? Object.create(null), this.childrenPrefixes = null != t ? Object.keys(t).map(Number) : [], this.store = n ?? null
        }
        getChild(e) {
            if (null == this.children) return null;
            if ("x" === e) {
                const e = C(this.childrenPrefixes);
                return null == e ? null : this.children[e] ?? null
            }
            return this.children[e] ?? null
        }
        addChild(e) {
            const t = this.getChild(e.prefix);
            return null == t && (this.children[e.prefix] = e, this.childrenPrefixes.push(e.prefix)), t ?? e
        }
        removeChild(e) {
            if ("x" === e) return this.children = Object.create(null), this.childrenPrefixes = [], this;
            if (null != this.children[e]) {
                const t = Number(e);
                if (Number.isNaN(t)) return this;
                delete this.children[t], this.childrenPrefixes.splice(this.childrenPrefixes.indexOf(t), 1)
            }
            return this
        }
        setStore(e) {
            return this.store = e, this
        }
        get length() {
            return this.childrenPrefixes.length
        }
    }

    function E(e) {
        const t = "*" === e ? "x.x.x" : e,
            n = t.indexOf("."),
            r = t.indexOf(".", n + 1);
        return {
            major: t.slice(0, n),
            minor: -1 === r ? t.slice(n + 1) : t.slice(n + 1, r),
            patch: -1 === r ? "x" : t.slice(r + 1)
        }
    }
    class T {
        constructor() {
            this.tree = new x
        }
        set(e, t) {
            let n = this.tree;
            const r = e.split(".");
            for (; r.length;) n = n.addChild(new x(r.shift()));
            return n.setStore(t), this
        }
        get(e) {
            let t = this.tree;
            const n = E(e);
            return t = t.getChild(n.major), null == t ? null : (t = t.getChild(n.minor), null == t ? null : (t = t.getChild(n.patch), null == t ? null : t.store))
        }
        del(e) {
            const t = E(e);
            if ("x" === t.major) return this.tree = new x, this;
            const n = this.tree.children[t.major];
            if (null == n) return this;
            if ("x" === t.minor) return this.tree.removeChild(t.major), this;
            const r = n.children[t.minor];
            if (null == r) return this;
            if ("x" === t.patch) return n.removeChild(t.minor), 0 === n.length && this.tree.removeChild(t.major), this;
            return null == r.children[t.patch] || (r.removeChild(t.patch), 0 === r.length && (n.removeChild(t.minor), 0 === n.length && this.tree.removeChild(t.major))), this
        }
        empty() {
            return this.tree = new x, this
        }
    }
    const O = {
            storage: () => new T,
            deriveVersion: e => e.headers.get("accept-version")
        },
        A = /^https?:\/\/.*?\//;
    class R {
        constructor(e) {
            if ((e = e || {}).defaultRoute) {
                if ("function" != typeof e.defaultRoute) throw new Error("The default route must be a function");
                this.defaultRoute = e.defaultRoute
            } else this.defaultRoute = null;
            if (e.onBadUrl) {
                if ("function" != typeof e.onBadUrl) throw new Error("The bad url handler must be a function");
                this.onBadUrl = e.onBadUrl
            } else this.onBadUrl = null;
            this.caseSensitive = null == e.caseSensitive || e.caseSensitive, this.ignoreTrailingSlash = e.ignoreTrailingSlash || !1, this.maxParamLength = e.maxParamLength || 100, this.allowUnsafeRegex = e.allowUnsafeRegex || !1, this.versioning = e.versioning || O, this.tree = new o({
                versions: this.versioning.storage()
            }), this.routes = []
        }
        on(e, t, n, r, i) {
            if ("function" == typeof n && (void 0 !== r && (i = r), r = n, n = {}), "string" != typeof t) throw new Error("Path should be a string");
            if (0 === t.length) throw new Error("The path could not be empty");
            if ("/" !== t[0] && "*" !== t[0]) throw new Error("The first character of a path should be `/` or `*`");
            if ("function" != typeof r) throw new Error("Handler should be a function");
            this._on(e, t, n, r, i), this.ignoreTrailingSlash && "/" !== t && !t.endsWith("*") && (t.endsWith("/") ? this._on(e, t.slice(0, -1), n, r, i) : this._on(e, t + "/", n, r, i))
        }
        _on(e, t, n, r, i) {
            if (Array.isArray(e)) {
                for (var o = 0; o < e.length; o++) this._on(e[o], t, n, r, i);
                return
            }
            if ("string" != typeof e) throw new Error("Method should be a string");
            if (!s.includes(e)) throw new Error(`Method '${e}' is not an http method.`);
            if (void 0 !== n.version && "string" != typeof n.version) throw new Error("Version should be a string");
            const a = [];
            var u = 0;
            this.routes.push({
                method: e,
                path: t,
                opts: n,
                handler: r,
                store: i
            });
            const h = n.version;
            for (var d = 0, c = t.length; d < c; d++)
                if (58 === t.charCodeAt(d)) {
                    var f = l.PARAM;
                    u = d + 1;
                    var p = t.slice(0, d);
                    !1 === this.caseSensitive && (p = p.toLowerCase()), this._insert(e, p, l.STATIC, null, null, null, null, h);
                    for (var m = !1; d < c && 47 !== t.charCodeAt(d);) {
                        if (m = m || "(" === t[d]) {
                            d = P(t, d) + 1;
                            break
                        }
                        if (45 === t.charCodeAt(d)) break;
                        d++
                    }!m || d !== c && 47 !== t.charCodeAt(d) ? d < c && 47 !== t.charCodeAt(d) && (f = l.MULTI_PARAM) : f = l.REGEX;
                    var b = t.slice(u, d),
                        g = m ? b.slice(b.indexOf("("), d) : null;
                    if (m && (g = new RegExp(g)), a.push(b.slice(0, m ? b.indexOf("(") : d)), t = t.slice(0, u) + t.slice(d), (d = u) === (c = t.length)) {
                        var w = t.slice(0, d);
                        return !1 === this.caseSensitive && (w = w.toLowerCase()), this._insert(e, w, f, a, r, i, g, h)
                    }
                    p = t.slice(0, d), !1 === this.caseSensitive && (p = p.toLowerCase()), this._insert(e, p, f, a, null, null, g, h), d--
                } else if (42 === t.charCodeAt(d)) return this._insert(e, t.slice(0, d), l.STATIC, null, null, null, null, h), a.push("*"), this._insert(e, t.slice(0, c), l.MATCH_ALL, a, r, i, null, h);
            !1 === this.caseSensitive && (t = t.toLowerCase()), this._insert(e, t, l.STATIC, a, r, i, null, h)
        }
        _insert(e, t, n, r, i, l, s, a) {
            const u = t;
            for (var h = this.tree, d = "", c = 0, f = 0, p = 0, m = 0, b = null;;) {
                for (f = (d = h.prefix).length, p = 0, m = (c = t.length) < f ? c : f; p < m && t[p] === d[p];) p++;
                if (p < f)
                    if (b = new o({
                            prefix: d.slice(p),
                            children: h.children,
                            kind: h.kind,
                            handlers: new o.Handlers(h.handlers),
                            regex: h.regex,
                            versions: h.versions
                        }), null !== h.wildcardChild && (b.wildcardChild = h.wildcardChild), h.reset(d.slice(0, p), this.versioning.storage()).addChild(b), p === c) {
                        if (a) {
                            if (h.getVersionHandler(a, e)) throw new Error(`Method '${e}' already declared for route '${u}' version '${a}'`);
                            h.setVersionHandler(a, e, i, r, l)
                        } else {
                            if (h.getHandler(e)) throw new Error(`Method '${e}' already declared for route '${u}'`);
                            h.setHandler(e, i, r, l)
                        }
                        h.kind = n
                    } else b = new o({
                        prefix: t.slice(p),
                        kind: n,
                        handlers: null,
                        regex: s,
                        versions: this.versioning.storage()
                    }), a ? b.setVersionHandler(a, e, i, r, l) : b.setHandler(e, i, r, l), h.addChild(b);
                else if (p < c) {
                    if (t = t.slice(p), b = h.findByLabel(t)) {
                        h = b;
                        continue
                    }
                    b = new o({
                        prefix: t,
                        kind: n,
                        handlers: null,
                        regex: s,
                        versions: this.versioning.storage()
                    }), a ? b.setVersionHandler(a, e, i, r, l) : b.setHandler(e, i, r, l), h.addChild(b)
                } else if (i)
                    if (a) {
                        if (h.getVersionHandler(a, e)) throw new Error(`Method '${e}' already declared for route '${u}' version '${a}'`);
                        h.setVersionHandler(a, e, i, r, l)
                    } else {
                        if (h.getHandler(e)) throw new Error(`Method '${e}' already declared for route '${u}'`);
                        h.setHandler(e, i, r, l)
                    } return
            }
        }
        reset() {
            this.tree = new o({
                versions: this.versioning.storage()
            }), this.routes = []
        }
        off(e, t) {
            var n = this;
            if (Array.isArray(e)) return e.map((function(e) {
                return n.off(e, t)
            }));
            if ("string" != typeof e) throw new Error("Method should be a string");
            if (!s.includes(e)) throw new Error(`Method '${e}' is not an http method.`);
            if ("string" != typeof t) throw new Error("Path should be a string");
            if (0 === t.length) throw new Error("The path could not be empty");
            if ("/" !== t[0] && "*" !== t[0]) throw new Error("The first character of a path should be `/` or `*`");
            const r = this.ignoreTrailingSlash;
            var i = n.routes.filter((function(n) {
                if (!r) return !(e === n.method && t === n.path);
                if (t.endsWith("/")) {
                    const r = t === n.path || t.slice(0, -1) === n.path;
                    return !(e === n.method && r)
                }
                const i = t === n.path || t + "/" === n.path;
                return !(e === n.method && i)
            }));
            r && (i = i.filter((function(e, t, n) {
                return e.path.endsWith("/") && t < n.length - 1 ? e.path.slice(0, -1) !== n[t + 1].path : !(!1 === e.path.endsWith("/") && t < n.length - 1) || e.path + "/" !== n[t + 1].path
            }))), n.reset(), i.forEach((function(e) {
                n.on(e.method, e.path, e.opts, e.handler, e.store)
            }))
        }
        lookup(e) {
            var t = this.find(e.method, function(e) {
                for (var t = 0, n = e.length; t < n; t++) {
                    var r = e.charCodeAt(t);
                    if (63 === r || 59 === r || 35 === r) return e.slice(0, t)
                }
                return e
            }(e.url), this.versioning.deriveVersion(e));
            return null === t ? this._defaultRoute(e) : t.handler(e, t.params, t.store)
        }
        find(e, n, r) {
            47 !== n.charCodeAt(0) && (n = n.replace(A, "/"));
            var i = n,
                o = n.length;
            !1 === this.caseSensitive && (n = n.toLowerCase());
            for (var s = this.maxParamLength, a = this.tree, u = null, h = 0, d = null, c = 0, f = [], p = 0, m = 0;;) {
                var b = n.length,
                    g = a.prefix,
                    w = g.length,
                    y = 0,
                    v = n;
                if (0 === b || n === g) {
                    var C = null == r ? a.handlers[e] : a.getVersionHandler(r, e);
                    if (null != C) {
                        var x = {};
                        if (C.paramsLength > 0) {
                            var E = C.params;
                            for (p = 0; p < C.paramsLength; p++) x[E[p]] = f[p]
                        }
                        return {
                            handler: C.handler,
                            params: x,
                            store: C.store
                        }
                    }
                }
                for (p = b < w ? b : w; y < p && n.charCodeAt(y) === g.charCodeAt(y);) y++;
                y === w && (b = (n = n.slice(y)).length, m += y);
                var T = null == r ? a.findChild(n, e) : a.findVersionChild(r, n, e);
                if (null === T) {
                    if (null === (T = a.parametricBrother)) return this._getWildcardNode(u, e, i, h);
                    var O = 47 === v.charCodeAt(0) ? v : "/" + v;
                    if (-1 === i.indexOf(O)) {
                        var R = i.slice(0, o - b);
                        v = R.slice(R.lastIndexOf("/") + 1, R.length) + n
                    }
                    m -= v.length - n.length, n = v, b = v.length, y = w
                }
                var P = T.kind;
                if (P !== l.STATIC) {
                    if (y !== w) return this._getWildcardNode(u, e, i, h);
                    if (null !== a.wildcardChild && null !== a.wildcardChild.handlers[e] && (u = a.wildcardChild, h = b), P !== l.PARAM)
                        if (P !== l.MATCH_ALL)
                            if (P !== l.REGEX)
                                if (P !== l.MULTI_PARAM) u = null;
                                else {
                                    if (a = T, p = 0, null !== T.regex) {
                                        var U = n.match(T.regex);
                                        if (null === U) return null;
                                        p = U[1].length
                                    } else {
                                        for (; p < b && 47 !== n.charCodeAt(p) && 45 !== n.charCodeAt(p);) p++;
                                        if (p > s) return null
                                    }
                                    if (null === (d = t(i.slice(m, m + p)))) return null !== this.onBadUrl ? this._onBadUrl(i.slice(m, m + p)) : null;
                                    f[c++] = d, n = n.slice(p), m += p
                                }
                    else {
                        if (a = T, -1 === (p = n.indexOf("/")) && (p = b), p > s) return null;
                        if (null === (d = t(i.slice(m, m + p)))) return null !== this.onBadUrl ? this._onBadUrl(i.slice(m, m + p)) : null;
                        if (!T.regex.test(d)) return null;
                        f[c++] = d, n = n.slice(p), m += p
                    } else {
                        if (null === (d = t(i.slice(m)))) return null !== this.onBadUrl ? this._onBadUrl(i.slice(m)) : null;
                        f[c] = d, a = T, n = ""
                    } else {
                        if (a = T, -1 === (p = n.indexOf("/")) && (p = b), p > s) return null;
                        if (null === (d = t(i.slice(m, m + p)))) return null !== this.onBadUrl ? this._onBadUrl(i.slice(m, m + p)) : null;
                        f[c++] = d, n = n.slice(p), m += p
                    }
                } else null !== a.wildcardChild && null !== a.wildcardChild.handlers[e] && (u = a.wildcardChild, h = b), a = T
            }
        }
        _getWildcardNode(e, n, r, i) {
            if (null === e) return null;
            var l = t(r.slice(-i));
            if (null === l) return null !== this.onBadUrl ? this._onBadUrl(r.slice(-i)) : null;
            var o = e.handlers[n];
            return null != o ? {
                handler: o.handler,
                params: {
                    "*": l
                },
                store: o.store
            } : null
        }
        _defaultRoute(e) {
            return null !== this.defaultRoute ? this.defaultRoute(e) : new Response(null, {
                statusCode: 404
            })
        }
        _onBadUrl(e) {
            const t = this.onBadUrl;
            return {
                handler: n => t(e, n),
                params: {},
                store: null
            }
        }
        prettyPrint() {
            return this.tree.prettyPrint("", !0)
        }
        all(e, t, n) {
            this.on(s, e, t, n)
        }
    }
    for (const e of s) {
        const t = e.toLowerCase();
        if (R.prototype[e]) throw new Error("Method already exists: " + e);
        if (R.prototype[t]) throw new Error("Method already exists: " + t);
        R.prototype[t] = function(t, n, r) {
            return this.on(e, t, n, r)
        }
    }

    function P(e, t) {
        for (var n = 1; t < e.length;)
            if ("\\" !== e[++t]) {
                if (")" === e[t] ? n-- : "(" === e[t] && n++, !n) return t
            } else t++;
        throw new TypeError('Invalid regexp expression in "' + e + '"')
    }
    const U = function() {
            let e = Object.create(null);
            return {
                define(t, n) {
                    e[t] = n
                },
                get: t => e[t],
                remove(t) {
                    delete e[t]
                },
                reset() {
                    e = Object.create(null)
                }
            }
        }(),
        S = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

    function k(e) {
        return S[e]
    }

    function L(e, t) {
        const n = U.get(e);
        if (null == n) throw new Error(`Can not find template \`${e}\``);
        return n(t, N)
    }
    const N = {
        async: !1,
        autoEscape: !0,
        autoTrim: [!1, "nl"],
        cache: !0,
        e: function(e) {
            const t = String(e);
            return /[&<>"']/.test(t) ? t.replace(/[&<>"']/g, k) : t
        },
        include: L,
        includeFile: L,
        parse: {
            exec: "",
            interpolate: "=",
            raw: "~"
        },
        plugins: [],
        rmWhitespace: !0,
        tags: ["<%", "%>"],
        templates: U,
        useWith: !1,
        varName: "it"
    };

    function I(e) {
        return t = e, o = "", (n = N).include.bind(n), s = n.includeFile.bind(n), i = "layouts/main.eta", l = {
            title: "Page Not Found"
        }, o += '\n<header class="container">\n  <h1 class="title" style="text-align: center;">Page Not Found</h1>\n</header>\n<main class="container">\n  <blockquote>\n    <p><em>Oops, The URL</em> <a href="', o += n.e(t.url), o += '">', o += n.e(t.url), o += "</a> <em>is invalid.</em></p>\n  </blockquote>\n</main>\n", i && (o = s(i, Object.assign(t, {
            body: o
        }, l))), r && r(null, o), o;
        var t, n, r, i, l, o, s
    }

    function B(e) {
        return t = e, s = "", (n = N).include.bind(n), a = n.includeFile.bind(n), i = "layouts/main.eta", l = o, s += '\n<header class="container">\n  <h1 class="title" style="text-align: center;">Download Proxy</h1>\n</header>\n<main class="container">\n  <form method="GET" action="', s += n.e(t.endpoint), s += '">\n    <fieldset>\n      <label for="url">Original URL</label>\n      <div class="row">\n        <input class="column column-75" type="text" placeholder="https://..." id="url" name="url">\n        <input class="column column-25 button-primary" type="submit" value="Download">\n      </div>\n    </fieldset>\n  </form>\n</main>\n', i && (s = a(i, Object.assign(t, {
            body: s
        }, l))), r && r(null, s), s;
        var t, n, r, i, l, o, s, a
    }
    N.templates.define("layouts/main.eta", (function(e, t, n) {
        var r = "";
        return t.include.bind(t), t.includeFile.bind(t), r += '<!DOCTYPE html>\n<html lang="en">\n<head>\n  ', r += t.include("partials/header.eta"), r += "  <title>", r += t.e(e.title), r += "</title>\n</head>\n<body>\n  ", r += e.body, r += "</body>\n</html>\n", n && n(null, r), r
    })), N.templates.define("partials/header.eta", (function(e, t, n) {
        var r = "";
        return t.include.bind(t), t.includeFile.bind(t), r += '<meta charset="UTF-8">\n<meta name="viewport"\n      content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">\n<meta http-equiv="X-UA-Compatible" content="ie=edge">\n<link rel="stylesheet" href="/_assets/style.css">\n<style>\nbody {\n  height: 100vh;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n}\n</style>\n', n && n(null, r), r
    }));
    const H = new R({
        ignoreTrailingSlash: !0,
        defaultRoute: e => new Response(I({
            url: e.url
        }), {
            status: 404,
            headers: {
                "Content-Type": "text/html; charset=utf-8"
            }
        })
    });
    H.get("/_assets/style.css", (() => new Response("*,*:after,*:before{box-sizing:inherit}html{box-sizing:border-box;font-size:62.5%}body{color:#606c76;font-family:'Roboto', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;font-size:1.6em;font-weight:300;letter-spacing:.01em;line-height:1.6}blockquote{border-left:0.3rem solid #d1d1d1;margin-left:0;margin-right:0;padding:1rem 1.5rem}blockquote *:last-child{margin-bottom:0}.button,button,input[type='button'],input[type='reset'],input[type='submit']{background-color:#9b4dca;border:0.1rem solid #9b4dca;border-radius:.4rem;color:#fff;cursor:pointer;display:inline-block;font-size:1.1rem;font-weight:700;height:3.8rem;letter-spacing:.1rem;line-height:3.8rem;padding:0 3.0rem;text-align:center;text-decoration:none;text-transform:uppercase;white-space:nowrap}.button:focus,.button:hover,button:focus,button:hover,input[type='button']:focus,input[type='button']:hover,input[type='reset']:focus,input[type='reset']:hover,input[type='submit']:focus,input[type='submit']:hover{background-color:#606c76;border-color:#606c76;color:#fff;outline:0}.button[disabled],button[disabled],input[type='button'][disabled],input[type='reset'][disabled],input[type='submit'][disabled]{cursor:default;opacity:.5}.button[disabled]:focus,.button[disabled]:hover,button[disabled]:focus,button[disabled]:hover,input[type='button'][disabled]:focus,input[type='button'][disabled]:hover,input[type='reset'][disabled]:focus,input[type='reset'][disabled]:hover,input[type='submit'][disabled]:focus,input[type='submit'][disabled]:hover{background-color:#9b4dca;border-color:#9b4dca}.button.button-outline,button.button-outline,input[type='button'].button-outline,input[type='reset'].button-outline,input[type='submit'].button-outline{background-color:transparent;color:#9b4dca}.button.button-outline:focus,.button.button-outline:hover,button.button-outline:focus,button.button-outline:hover,input[type='button'].button-outline:focus,input[type='button'].button-outline:hover,input[type='reset'].button-outline:focus,input[type='reset'].button-outline:hover,input[type='submit'].button-outline:focus,input[type='submit'].button-outline:hover{background-color:transparent;border-color:#606c76;color:#606c76}.button.button-outline[disabled]:focus,.button.button-outline[disabled]:hover,button.button-outline[disabled]:focus,button.button-outline[disabled]:hover,input[type='button'].button-outline[disabled]:focus,input[type='button'].button-outline[disabled]:hover,input[type='reset'].button-outline[disabled]:focus,input[type='reset'].button-outline[disabled]:hover,input[type='submit'].button-outline[disabled]:focus,input[type='submit'].button-outline[disabled]:hover{border-color:inherit;color:#9b4dca}.button.button-clear,button.button-clear,input[type='button'].button-clear,input[type='reset'].button-clear,input[type='submit'].button-clear{background-color:transparent;border-color:transparent;color:#9b4dca}.button.button-clear:focus,.button.button-clear:hover,button.button-clear:focus,button.button-clear:hover,input[type='button'].button-clear:focus,input[type='button'].button-clear:hover,input[type='reset'].button-clear:focus,input[type='reset'].button-clear:hover,input[type='submit'].button-clear:focus,input[type='submit'].button-clear:hover{background-color:transparent;border-color:transparent;color:#606c76}.button.button-clear[disabled]:focus,.button.button-clear[disabled]:hover,button.button-clear[disabled]:focus,button.button-clear[disabled]:hover,input[type='button'].button-clear[disabled]:focus,input[type='button'].button-clear[disabled]:hover,input[type='reset'].button-clear[disabled]:focus,input[type='reset'].button-clear[disabled]:hover,input[type='submit'].button-clear[disabled]:focus,input[type='submit'].button-clear[disabled]:hover{color:#9b4dca}code{background:#f4f5f6;border-radius:.4rem;font-size:86%;margin:0 .2rem;padding:.2rem .5rem;white-space:nowrap}pre{background:#f4f5f6;border-left:0.3rem solid #9b4dca;overflow-y:hidden}pre>code{border-radius:0;display:block;padding:1rem 1.5rem;white-space:pre}hr{border:0;border-top:0.1rem solid #f4f5f6;margin:3.0rem 0}input[type='color'],input[type='date'],input[type='datetime'],input[type='datetime-local'],input[type='email'],input[type='month'],input[type='number'],input[type='password'],input[type='search'],input[type='tel'],input[type='text'],input[type='url'],input[type='week'],input:not([type]),textarea,select{-webkit-appearance:none;background-color:transparent;border:0.1rem solid #d1d1d1;border-radius:.4rem;box-shadow:none;box-sizing:inherit;height:3.8rem;padding:.6rem 1.0rem .7rem;width:100%}input[type='color']:focus,input[type='date']:focus,input[type='datetime']:focus,input[type='datetime-local']:focus,input[type='email']:focus,input[type='month']:focus,input[type='number']:focus,input[type='password']:focus,input[type='search']:focus,input[type='tel']:focus,input[type='text']:focus,input[type='url']:focus,input[type='week']:focus,input:not([type]):focus,textarea:focus,select:focus{border-color:#9b4dca;outline:0}select{background:url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 30 8\" width=\"30\"><path fill=\"%23d1d1d1\" d=\"M0,0l6,8l6-8\"/></svg>') center right no-repeat;padding-right:3.0rem}select:focus{background-image:url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 30 8\" width=\"30\"><path fill=\"%239b4dca\" d=\"M0,0l6,8l6-8\"/></svg>')}select[multiple]{background:none;height:auto}textarea{min-height:6.5rem}label,legend{display:block;font-size:1.6rem;font-weight:700;margin-bottom:.5rem}fieldset{border-width:0;padding:0}input[type='checkbox'],input[type='radio']{display:inline}.label-inline{display:inline-block;font-weight:normal;margin-left:.5rem}.container{margin:0 auto;max-width:112.0rem;padding:0 2.0rem;position:relative;width:100%}.row{display:flex;flex-direction:column;padding:0;width:100%}.row.row-no-padding{padding:0}.row.row-no-padding>.column{padding:0}.row.row-wrap{flex-wrap:wrap}.row.row-top{align-items:flex-start}.row.row-bottom{align-items:flex-end}.row.row-center{align-items:center}.row.row-stretch{align-items:stretch}.row.row-baseline{align-items:baseline}.row .column{display:block;flex:1 1 auto;margin-left:0;max-width:100%;width:100%}.row .column.column-offset-10{margin-left:10%}.row .column.column-offset-20{margin-left:20%}.row .column.column-offset-25{margin-left:25%}.row .column.column-offset-33,.row .column.column-offset-34{margin-left:33.3333%}.row .column.column-offset-40{margin-left:40%}.row .column.column-offset-50{margin-left:50%}.row .column.column-offset-60{margin-left:60%}.row .column.column-offset-66,.row .column.column-offset-67{margin-left:66.6666%}.row .column.column-offset-75{margin-left:75%}.row .column.column-offset-80{margin-left:80%}.row .column.column-offset-90{margin-left:90%}.row .column.column-10{flex:0 0 10%;max-width:10%}.row .column.column-20{flex:0 0 20%;max-width:20%}.row .column.column-25{flex:0 0 25%;max-width:25%}.row .column.column-33,.row .column.column-34{flex:0 0 33.3333%;max-width:33.3333%}.row .column.column-40{flex:0 0 40%;max-width:40%}.row .column.column-50{flex:0 0 50%;max-width:50%}.row .column.column-60{flex:0 0 60%;max-width:60%}.row .column.column-66,.row .column.column-67{flex:0 0 66.6666%;max-width:66.6666%}.row .column.column-75{flex:0 0 75%;max-width:75%}.row .column.column-80{flex:0 0 80%;max-width:80%}.row .column.column-90{flex:0 0 90%;max-width:90%}.row .column .column-top{align-self:flex-start}.row .column .column-bottom{align-self:flex-end}.row .column .column-center{align-self:center}@media (min-width: 40rem){.row{flex-direction:row;margin-left:-1.0rem;width:calc(100% + 2.0rem)}.row .column{margin-bottom:inherit;padding:0 1.0rem}}a{color:#9b4dca;text-decoration:none}a:focus,a:hover{color:#606c76}dl,ol,ul{list-style:none;margin-top:0;padding-left:0}dl dl,dl ol,dl ul,ol dl,ol ol,ol ul,ul dl,ul ol,ul ul{font-size:90%;margin:1.5rem 0 1.5rem 3.0rem}ol{list-style:decimal inside}ul{list-style:circle inside}.button,button,dd,dt,li{margin-bottom:1.0rem}fieldset,input,select,textarea{margin-bottom:1.5rem}blockquote,dl,figure,form,ol,p,pre,table,ul{margin-bottom:2.5rem}table{border-spacing:0;display:block;overflow-x:auto;text-align:left;width:100%}td,th{border-bottom:0.1rem solid #e1e1e1;padding:1.2rem 1.5rem}td:first-child,th:first-child{padding-left:0}td:last-child,th:last-child{padding-right:0}@media (min-width: 40rem){table{display:table;overflow-x:initial}}b,strong{font-weight:bold}p{margin-top:0}h1,h2,h3,h4,h5,h6{font-weight:300;letter-spacing:-.1rem;margin-bottom:2.0rem;margin-top:0}h1{font-size:4.6rem;line-height:1.2}h2{font-size:3.6rem;line-height:1.25}h3{font-size:2.8rem;line-height:1.3}h4{font-size:2.2rem;letter-spacing:-.08rem;line-height:1.35}h5{font-size:1.8rem;letter-spacing:-.05rem;line-height:1.5}h6{font-size:1.6rem;letter-spacing:0;line-height:1.4}img{max-width:100%}.clearfix:after{clear:both;content:' ';display:table}.float-left{float:left}.float-right{float:right}\n\n/*# sourceMappingURL=milligram.min.css.map */", {
        headers: {
            "Content-Type": "text/css; charset=utf-8"
        }
    }))), H.get("/", (() => new Response(B({
        title: "Download Proxy",
        endpoint: "/api/download"
    }), {
        headers: {
            "Content-Type": "text/html; charset=utf-8"
        }
    }))), H.get("/api/download", (async e => {
        const t = new URL(e.url);
        let n = null;
        for (const [e, r] of t.searchParams) "url" === e && (n = decodeURIComponent(r));
        if (null == n || 0 === n.length) return new Response((r = {
            error: "Download URL is empty!"
        }, o = "", (i = N).include.bind(i), i.includeFile.bind(i), o += '<!DOCTYPE html>\n<html lang="en">\n<head>\n  ', o += i.include("partials/header.eta"), o += '  <title>Error Occurred</title>\n</head>\n<body>\n  <header class="container">\n    <h1 class="title" style="text-align: center;">Error Occurred</h1>\n  </header>\n  <main class="container">\n    <blockquote>\n      <p style="color: #f44336"><em>', o += i.e(r.error), o += "</em></p>\n    </blockquote>\n  </main>\n</body>\n</html>\n", l && l(null, o), o), {
            status: 400,
            headers: {
                "Content-Type": "text/html; charset=utf-8"
            }
        });
        var r, i, l, o;
        let {
            headers: s,
            body: a
        } = await fetch(n, {
            headers: e.headers
        });
        const u = s.get("Content-Disposition");
        if (null == u || !u.includes("filename=")) {
            const e = n.split("/");
            if (e.length > 0) {
                const t = e[e.length - 1];
                s = new Headers(s), s.set("Content-Disposition", `attachment; filename="${t}"`)
            }
        }
        return new Response(a, {
            headers: s
        })
    })), addEventListener("fetch", (e => {
        try {
            e.respondWith((t = e.request, H.lookup(t)))
        } catch (t) {
            e.respondWith(new Response(t.message ?? t.toString(), {
                status: 500
            }))
        }
        var t
    }))
}();
