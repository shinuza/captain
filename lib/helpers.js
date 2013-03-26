var crypto = require('crypto'),
    path = require('path'),
    fs = require('fs'),
    join = path.join,
    resolve = path.resolve,
    terminal = require('captain-core/lib/util/terminal'),
    uuid = require('captain-core/lib/util/crypto').uuid;

var PKG = require('../package.json'),
    VERSION = PKG.version,
    PROJECT_NAME = PKG.name,
    cwd = process.cwd();

exports.EOL = EOL = process.platform === 'win32' ? '\r\n' : '\n';

/**
 * Returns str preceded by four spaces.
 *
 * @param str
 */

function pad(str) {
  return '    ' + str;
}
exports.pad = pad;

  /**
 * echo str > path.
 *
 * @param {String} path
 * @param {String} str
 */

function write(path, str) {
  fs.writeFileSync(path, str);
  console.log(terminal.cyan(pad('create : ')) + path);
}
exports.write = write;

/**
 * Reads `input` and outputs its content to `output`.
 *
 * @param {String} input
 * @param {String} output
 */

function copy(input, output) {
  write(output, fs.readFileSync(input));
}
exports.copy = copy;

/**
 * Checks if `p` exists
 *
 * @param p
 */
var exists = exports.exists = (fs.existsSync) ? fs.existsSync : path.existsSync;

/**
 * mkdir -p
 *
 * @param {String} path
 */

function mkdir(path, silent) {
  if(!exists(path)) {
    fs.mkdirSync(path, 0755);
    if(!silent) console.log(terminal.cyan(pad('create : ')) + path);
  }
}
exports.mkdir = mkdir;

/**
 * Creates on dir at `base`, and x `subs` under it.
 *
 * @param {String} base
 * @param {Array} subs
 */

exports.dirs = function dirs(base, subs) {
  mkdir(base);
  subs.forEach(function(sub) {
    mkdir(join(base, sub));
  });
};

/**
 * cp -R
 *
 */

exports.copyR = function copyR(files, target) {
  var from, to,
    base = resolve(__dirname, '..');

  files.forEach(function(file) {
    from = join(base, file);
    to = join(target, file);

    if(isDirectory(from)) {
      mkdir(to);
      fs.readdirSync(from).forEach(function(entry) {
        copyR([join(file, entry)], target);
      });
    } else {
      copy(from, to);
    }
  });
};

/**
 * Tests if `path` is a directory.
 *
 * @param {String} path
 */

function isDirectory(path) {
  var stat = fs.statSync(path);
  return stat.isDirectory();
}
exports.isDirectory = isDirectory;

  /**
 * Tests if `path` is empty.
 *
 * @param {String} path
 * @returns {Boolean}
 */

function isEmptyDirectory(path) {
  var files;
  try {
    files = fs.readdirSync(path);
    if(files.length > 0) {
      return false;
    }
  } catch(err) {
    if(err.code) {
      terminal.abort('Error: ', err);
    } else {
      throw e;
    }
  }
  return true;
}
exports.isEmptyDirectory = isEmptyDirectory;

/**
 * Checks if `cwd` is a captain project.
 *
 * @returns Boolean
 */

exports.isCaptainProject = function isCaptainProject() {
  try {
    var pkg = require(join(cwd, '/package.json'));
    return pkg.dependencies &&
      Object.keys(pkg.dependencies)
        .indexOf(PROJECT_NAME) !== -1;
  } catch(e) {
    if(e.code && e.code === 'MODULE_NOT_FOUND') {
      return false;
    } else {
      throw e;
    }
  }
};

/**
 * Creates project files for `name`
 *
 * @param {String} name
 * @returns {Object}
 */

exports.files = function files(name) {
  var index = [
    'var captain = require(\'' + PROJECT_NAME + '\'),'
    , '    conf = captain.conf;'
    , ''
    , 'captain.listen(conf.port, conf.host);'
  ].join(EOL);


  var conf_dev = [
    'module.exports = {'
    , '  "db": "tcp://username:password@localhost/database",',
    , '  "secret_key": "' + crypto.randomBytes(32).toString('base64') + '",',
    , '  "uuid": "' + uuid() +'"',
    , '}'
  ].join(EOL);

  var pkg = [
    '{'
    , '  "name": "' + name + '",'
    , '  "description": "",'
    , '  "version": "0.0.1",'
    , '  "private": true,'
    , '  "dependencies": {'
    , '    "' + PROJECT_NAME +'": "' + VERSION + '"'
    , '  }'
    , '}'
  ].join(EOL);

  return {
    'index.js': index,
    'package.json': pkg,
    'conf/development.js': conf_dev,
    'README.md': '## ' + name
  };
};