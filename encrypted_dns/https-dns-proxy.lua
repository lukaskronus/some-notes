return {
        name = "cf.zero.trust",
        label = _("CF ZeroTrust"),
        resolver_url = "",
        bootstrap_dns = "8.8.8.8, 9.9.9.11"
}

return {
        name = "dns.nextdns.io",
        label = _("NextDNS"),
        resolver_url = "https://doh3.dns.nextdns.io/52ac62",
        bootstrap_dns = "45.90.28.49,45.90.30.49",
        help_link = " https://my.nextdns.io",
        help_link_text = "NextDNS.io"
}
