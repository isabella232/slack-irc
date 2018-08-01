#!/usr/bin/env node
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _helpers = require('./helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* istanbul ignore next */

/* eslint-disable import/newline-after-import */
if (process.env.NODE_ENV === 'development') {
  _winston2.default.level = 'debug';
}

/* istanbul ignore next */
if (!module.parent) {
  var cli = require('./cli');
  cli();
}

exports.default = _helpers.createBots;
module.exports = exports['default'];