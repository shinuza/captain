var core = require('captain-core');
var admin = require('captain-admin');

core.use('/admin', admin);

module.exports = core;