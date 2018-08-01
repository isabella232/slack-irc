'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _ircUpd = require('irc-upd');

var _ircUpd2 = _interopRequireDefault(_ircUpd);

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _client = require('@slack/client');

var _errors = require('./errors');

var _emoji = require('../assets/emoji.json');

var _emoji2 = _interopRequireDefault(_emoji);

var _validators = require('./validators');

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ALLOWED_SUBTYPES = ['me_message', 'file_share'];
var REQUIRED_FIELDS = ['server', 'nickname', 'channelMapping', 'token'];

/**
 * An IRC bot, works as a middleman for all communication
 * @param {object} options
 */

var Bot = function () {
  function Bot(options) {
    var _this = this;

    _classCallCheck(this, Bot);

    REQUIRED_FIELDS.forEach(function (field) {
      if (!options[field]) {
        throw new _errors.ConfigurationError('Missing configuration field ' + field);
      }
    });

    (0, _validators.validateChannelMapping)(options.channelMapping);

    var web = new _client.WebClient(options.token);
    var rtm = new _client.RtmClient(options.token, { dataStore: new _client.MemoryDataStore() });
    this.slack = { web: web, rtm: rtm };

    this.server = options.server;
    this.nickname = options.nickname;
    this.ircOptions = options.ircOptions;
    this.ircStatusNotices = options.ircStatusNotices || {};
    this.commandCharacters = options.commandCharacters || [];
    this.channels = _lodash2.default.values(options.channelMapping);
    this.muteSlackbot = options.muteSlackbot || false;
    this.muteUsers = _extends({
      slack: [],
      irc: []
    }, options.muteUsers);
    this.muteWords = options.muteWords || [];

    var defaultUrl = 'http://api.adorable.io/avatars/48/$username.png';
    // Disable if it's set to false, override default with custom if available:
    this.avatarUrl = options.avatarUrl !== false && (options.avatarUrl || defaultUrl);
    this.slackUsernameFormat = options.slackUsernameFormat || '$username (IRC)';
    this.ircUsernameFormat = options.ircUsernameFormat == null ? '<$username> ' : options.ircUsernameFormat;
    this.channelMapping = {};

    // Remove channel passwords from the mapping and lowercase IRC channel names
    _lodash2.default.forOwn(options.channelMapping, function (ircChan, slackChan) {
      _this.channelMapping[slackChan] = ircChan.split(' ')[0].toLowerCase();
    }, this);

    this.invertedMapping = _lodash2.default.invert(this.channelMapping);
    this.autoSendCommands = options.autoSendCommands || [];
  }

  _createClass(Bot, [{
    key: 'connect',
    value: function connect() {
      _winston2.default.debug('Connecting to IRC and Slack');
      this.slack.rtm.start();

      var ircOptions = _extends({
        userName: this.nickname,
        realName: this.nickname,
        channels: this.channels,
        floodProtection: true,
        floodProtectionDelay: 500,
        retryCount: 10
      }, this.ircOptions);

      this.ircClient = new _ircUpd2.default.Client(this.server, this.nickname, ircOptions);
      this.attachListeners();
    }
  }, {
    key: 'attachListeners',
    value: function attachListeners() {
      var _this2 = this;

      this.slack.rtm.on('open', function () {
        _winston2.default.debug('Connected to Slack');
      });

      this.ircClient.on('registered', function (message) {
        _winston2.default.debug('Registered event: ', message);
        _this2.autoSendCommands.forEach(function (element) {
          var _ircClient;

          (_ircClient = _this2.ircClient).send.apply(_ircClient, _toConsumableArray(element));
        });
      });

      this.ircClient.on('error', function (error) {
        _winston2.default.error('Received error event from IRC', error);
      });

      this.ircClient.on('abort', function () {
        _winston2.default.error('Maximum IRC retry count reached, exiting.');
        process.exit(1);
      });

      this.slack.rtm.on('error', function (error) {
        _winston2.default.error('Received error event from Slack', error);
      });

      this.slack.rtm.on('message', function (message) {
        // Ignore bot messages and people leaving/joining
        if (message.type === 'message' && (!message.subtype || ALLOWED_SUBTYPES.indexOf(message.subtype) > -1)) {
          _this2.sendToIRC(message);
        }
      });

      this.ircClient.on('message', this.sendToSlack.bind(this));

      this.ircClient.on('notice', function (author, to, text) {
        var formattedText = '*' + text + '*';
        _this2.sendToSlack(author, to, formattedText);
      });

      this.ircClient.on('action', function (author, to, text) {
        var formattedText = '_' + text + '_';
        _this2.sendToSlack(author, to, formattedText);
      });

      this.ircClient.on('invite', function (channel, from) {
        _winston2.default.debug('Received invite:', channel, from);
        if (!_this2.invertedMapping[channel]) {
          _winston2.default.debug('Channel not found in config, not joining:', channel);
        } else {
          _this2.ircClient.join(channel);
          _winston2.default.debug('Joining channel:', channel);
        }
      });

      if (this.ircStatusNotices.join) {
        this.ircClient.on('join', function (channel, nick) {
          if (nick !== _this2.nickname) {
            _this2.sendToSlack(_this2.nickname, channel, '*' + nick + '* has joined the IRC channel');
          }
        });
      }

      if (this.ircStatusNotices.leave) {
        this.ircClient.on('part', function (channel, nick) {
          _this2.sendToSlack(_this2.nickname, channel, '*' + nick + '* has left the IRC channel');
        });

        this.ircClient.on('quit', function (nick, reason, channels) {
          channels.forEach(function (channel) {
            _this2.sendToSlack(_this2.nickname, channel, '*' + nick + '* has quit the IRC channel');
          });
        });
      }
    }
  }, {
    key: 'parseText',
    value: function parseText(text) {
      var dataStore = this.slack.rtm.dataStore;

      return text.replace(/\n|\r\n|\r/g, ' ').replace(/<!channel>/g, '@channel').replace(/<!group>/g, '@group').replace(/<!everyone>/g, '@everyone').replace(/<#(C\w+)\|?(\w+)?>/g, function (match, channelId, readable) {
        var _dataStore$getChannel = dataStore.getChannelById(channelId),
            name = _dataStore$getChannel.name;

        return readable || '#' + name;
      }).replace(/<@(U\w+)\|?(\w+)?>/g, function (match, userId, readable) {
        var _dataStore$getUserByI = dataStore.getUserById(userId),
            name = _dataStore$getUserByI.name;

        return readable || '@' + name;
      }).replace(/<(?!!)([^|]+?)>/g, function (match, link) {
        return link;
      }).replace(/<!(\w+)\|?(\w+)?>/g, function (match, command, label) {
        return '<' + (label || command) + '>';
      }).replace(/:(\w+):/g, function (match, emoji) {
        if (emoji in _emoji2.default) {
          return _emoji2.default[emoji];
        }

        return match;
      }).replace(/<.+?\|(.+?)>/g, function (match, readable) {
        return readable;
      }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
  }, {
    key: 'isCommandMessage',
    value: function isCommandMessage(message) {
      return this.commandCharacters.indexOf(message[0]) !== -1;
    }
  }, {
    key: 'sendToIRC',
    value: function sendToIRC(message) {
      var dataStore = this.slack.rtm.dataStore;

      var channel = dataStore.getChannelGroupOrDMById(message.channel);
      if (!channel) {
        _winston2.default.info('Received message from a channel the bot isn\'t in:', message.channel);
        return;
      }

      if (this.muteSlackbot && message.user === 'USLACKBOT') {
        _winston2.default.debug('Muted message from Slackbot: "' + message.text + '"');
        return;
      }

      var user = dataStore.getUserById(message.user);
      var username = this.ircUsernameFormat.replace(/\$username/g, user.name);

      if (this.muteUsers.slack.indexOf(user.name) !== -1) {
        _winston2.default.debug('Muted message from Slack ' + user.name + ': ' + message.text);
        return;
      }

      var channelName = channel.is_channel ? '#' + channel.name : channel.name;
      var ircChannel = this.channelMapping[channelName];

      _winston2.default.debug('Channel Mapping', channelName, this.channelMapping[channelName]);
      if (ircChannel) {
        var text = this.parseText(message.text);

        for (var i = 0; i < this.muteWords.length; i++) {
          if ((text || '').toLowerCase().indexOf(this.muteWords[i].toLowerCase()) >= 0) {
            return;
          }
        }

        if (this.isCommandMessage(text)) {
          var prelude = 'Command sent from Slack by ' + user.name + ':';
          this.ircClient.say(ircChannel, prelude);
        } else if (!message.subtype) {
          text = '' + username + text;
        } else if (message.subtype === 'file_share') {
          text = username + 'File uploaded ' + message.file.permalink + ' / ' + message.file.permalink_public;
          if (message.file.initial_comment) {
            text += ' - ' + message.file.initial_comment.comment;
          }
        } else if (message.subtype === 'me_message') {
          text = 'Action: ' + user.name + ' ' + text;
        }
        _winston2.default.debug('Sending message to IRC', channelName, text);
        this.ircClient.say(ircChannel, text);
      }
    }
  }, {
    key: 'sendToSlack',
    value: function sendToSlack(author, channel, text) {
      var slackChannelName = this.invertedMapping[channel.toLowerCase()];

      for (var i = 0; i < this.muteWords.length; i++) {
        if ((text || '').toLowerCase().indexOf(this.muteWords[i].toLowerCase()) >= 0) {
          return;
        }
      }

      if (slackChannelName) {
        var dataStore = this.slack.rtm.dataStore;

        var name = slackChannelName.replace(/^#/, '');
        var slackChannel = dataStore.getChannelOrGroupByName(name);

        // If it's a private group and the bot isn't in it, we won't find anything here.
        // If it's a channel however, we need to check is_member.
        if (!slackChannel || !slackChannel.is_member && !slackChannel.is_group) {
          _winston2.default.info('Tried to send a message to a channel the bot isn\'t in: ', slackChannelName);
          return;
        }

        if (this.muteUsers.irc.indexOf(author) !== -1) {
          _winston2.default.debug('Muted message from IRC ' + author + ': ' + text);
          return;
        }

        var currentChannelUsernames = slackChannel.members.map(function (member) {
          return dataStore.getUserById(member).name;
        });

        var mappedText = currentChannelUsernames.reduce(function (current, username) {
          return (0, _helpers.highlightUsername)(username, current);
        }, text);

        var iconUrl = void 0;
        if (author !== this.nickname && this.avatarUrl) {
          iconUrl = this.avatarUrl.replace(/\$username/g, author);
        }

        var options = {
          username: this.slackUsernameFormat.replace(/\$username/g, author),
          parse: 'full',
          icon_url: iconUrl
        };

        _winston2.default.debug('Sending message to Slack', mappedText, channel, '->', slackChannelName);
        this.slack.web.chat.postMessage(slackChannel.id, mappedText, options);
      }
    }
  }]);

  return Bot;
}();

exports.default = Bot;
module.exports = exports['default'];