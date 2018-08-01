'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createBots = createBots;
exports.highlightUsername = highlightUsername;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _bot = require('./bot');

var _bot2 = _interopRequireDefault(_bot);

var _errors = require('./errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Reads from the provided config file and returns an array of bots
 * @return {object[]}
 */
function createBots(configFile) {
  var bots = [];

  // The config file can be both an array and an object
  if (Array.isArray(configFile)) {
    configFile.forEach(function (config) {
      var bot = new _bot2.default(config);
      bot.connect();
      bots.push(bot);
    });
  } else if (_lodash2.default.isObject(configFile)) {
    var bot = new _bot2.default(configFile);
    bot.connect();
    bots.push(bot);
  } else {
    throw new _errors.ConfigurationError();
  }

  return bots;
}

/**
 * Returns occurances of a current channel member's name with `@${name}`
 * @return {string}
 */
function highlightUsername(user, text) {
  var words = text.split(' ');
  var userRegExp = new RegExp('^' + user + '[,.:!?]?$');

  return words.map(function (word) {
    // if the user is already prefixed by @, don't replace
    if (word.indexOf('@' + user) === 0) {
      return word;
    }

    // username match (with some chars)
    if (userRegExp.test(word)) {
      return '@' + word;
    }

    return word;
  }).join(' ');
}