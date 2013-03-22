var crypto = require('crypto'),
    join = path.join,
    resolve = path.resolve,
    terminal = require('captain-core/lib/util/terminal');

var PKG = require('../package.json'),
  VERSION = PKG.version,
  PROJECT_NAME = PKG.name,
  cwd = process.cwd();

/**
 * Returns str preceded by four spaces.
 *
 * @param str
 */

exports.pad = function pad(str) {
  return '    ' + str;
};

/**
 * echo str > path.
 *
 * @param {String} path
 * @param {String} str
 */

exports.write = function write(path, str) {
  fs.writeFileSync(path, str);
  console.log(terminal.cyan(pad('create : ')) + path);
};

/**
 * Reads `input` and outputs its content to `output`.
 *
 * @param {String} input
 * @param {String} output
 */

exports.copy = function copy(input, output) {
  write(output, fs.readFileSync(input));
};

/**
 * mkdir -p
 *
 * @param {String} path
 */

exports.mkdir = function mkdir(path) {
  if(!fs.existsSync(path)) {
    fs.mkdirSync(path, 0755);
    console.log(terminal.cyan(pad('create : ')) + path);
  }
};

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

exports.isDirectory = function isDirectory(path) {
  var stat = fs.statSync(path);
  return stat.isDirectory();
};

/**
 * Tests if `path` is empty.
 *
 * @param {String} path
 * @returns {Boolean}
 */

exports.isEmptyDirectory = function isEmptyDirectory(path) {
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
};

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
  ].join(os.EOL);


  var conf_dev = [
    'module.exports = {'
    , '  "db": "tcp://username:password@localhost/database",',
    , '  "secret_key": "' + crypto.randomBytes(32).toString('base64') + '",',
    , '  "uuid": "' + uuid() +'"',
    , '}'
  ].join(os.EOL);

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
  ].join(os.EOL);

  return {
    'index.js': index,
    'package.json': pkg,
    'conf/development.js': conf_dev,
    'README.md': '## ' + name
  };
};