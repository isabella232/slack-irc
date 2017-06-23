module.exports = {
        "nickname": "hackatron-bridge",
        "server": "irc.freenode.net",
        "token": process.env.SLACK_TOKEN,
        "channelMapping": {
                "old-school": "#hackatron"
        },
        "ircOptions": {
                "debug": true,
                "showErrors": true,
                "floodProtection": false,
                "floodProtectionDelay": 1000,
                "port": 6697,
                "sasl": true,
                "secure": true,
                "selfSigned": true,
                "certExpired": true,
                "userName": "hackatron-bridge",
                "nick": "hackatron-bridge",
                "password": process.env.IRC_PASSWORD
        }
}
