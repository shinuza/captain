#! /usr/bin/env node
var path = require('path');
var join = path.join;
var resolve = path.join;
var mkdir = require('../lib/helpers').mkdir;
var markdox = require('markdox');

var PROJECT_ROOT = resolve(__dirname, '..');

mkdir(join(PROJECT_ROOT, 'docs'));
markdox.process([join(__dirname, 'captain.js')], join(PROJECT_ROOT, 'docs', 'docs.md'), function() {
  console.log('Generated', join('docs', 'docs.md'));
});