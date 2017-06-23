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
                "sasl": true,
                "userName": "hackatron-bridge",
                "password": process.env.IRC_PASSWORD
        }
}
