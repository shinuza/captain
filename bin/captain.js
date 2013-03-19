#!/usr/bin/env node
var fs = require('fs'),
    os = require('os'),
    path = require('path');

var program = require('commander'),
    async = require('async'),
    ncp = require('ncp'),
    db = require('captain-core/lib/db'),
    util = require('captain-core/lib/util');

var PKG = require('../package.json');
var VERSION = PKG.version;
var PROJECT_NAME = PKG.name;
var cwd = process.cwd();

const PROJECT_ROOT = path.resolve(__dirname, '..');

program
  .version(VERSION)
  .option('createuser', 'Creates a user account')
  .option('syncdb', 'Synchronise all definitions')
  .option('loaddata [filename]', 'Loads data')
  .option('themes', 'Display available themes')
  .option('theme [theme]', 'Install theme')
  .option('run', 'Run captain project')
  .option('init [projectname]', 'Creates a new project')
  .option('-f, --force', 'Force operation')
  .parse(process.argv);

/**
 * Returns str preceded by four spaces
 *
 * @param str
 */

function pad(str) {
  return '    ' + str;
}

/**
 * echo str > path.
 *
 * @param {String} path
 * @param {String} str
 */

function write(path, str) {
  fs.writeFileSync(path, str);
  console.log(util.cyan(pad('create : ')) + path);
}

/**
 * Reads `_in` and outputs its content to `_out`
 *
 * @param {String} _in
 * @param {String} _out
 */

function copy(_in, _out) {
  fs.writeFileSync(_out, fs.readFileSync(_in));
}

/**
 * Mkdir.
 *
 * @param {String} path
 */

function mkdir(path) {
  if(!fs.existsSync(path)) {
    fs.mkdirSync(path, 0755);
    console.log(util.cyan(pad('create : ')) + path);
  } else {
    console.log(util.yellow(pad('dir exists : ')) + path);
  }
}

/**
 *
 * Creates on dir at `base`, and x `subs` under it.
 *
 * @param {String} base
 * @param {Array} subs
 */

function dirs(base, subs) {
  mkdir(base);
  subs.forEach(function(sub) {
    mkdir(path.join(base, sub));
  });
}

/**
 * Install `theme` in `cwd/root`
 *
 * @param root
 * @param theme
 */

function installTheme(root, theme, fn) {
  theme = path.join(PROJECT_ROOT, 'themes', theme);

  //TODO: Replace ncp with own copy function
  if(fs.existsSync(theme)) {
    ncp(theme, path.join(cwd, root, 'themes'), fn);
  } else {
    util.abort('Theme not found');
  }
}

/**
 * Copy `asset` to `./assets/asset`
 *
 * @param {String} root
 * @param {Array} assets
 */

function copyAssets(root, assets) {
  var _file, _in, _out;

  assets.forEach(function(asset) {
    _file = path.join('assets', asset);
    _in = path.join(PROJECT_ROOT, _file);
    _out = path.join(cwd, root, _file);
    copy(_in, _out);
    console.log(util.cyan(pad('create : ')) + path.join(root, _file));
  });
}

/**
 * Tests if `path` is a directory.
 *
 * @param path
 */

function isDirectory(path) {
  var stat = fs.statSync(path);
  return stat.isDirectory();
}

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
      util.abort('Error: ', err);
    } else {
      throw e;
    }
  }
  return true;
}

/**
 * Checks if cwd is a captain project
 *
 * @returns Boolean
 */

function isCaptainProject() {
  try {
    var pkg = require(path.join(cwd, '/package.json'));
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
}

// Templates

function files(name) {
  var index = [
    , 'var captain = require(\'' + PROJECT_NAME + '\'),'
    , '    core = captain.core,'
    , '    admin = captain.admin;'
    , ''
    , 'captain.use(\'/admin\', admin);'
    , 'captain.use(core);'
    , ''
    , 'exports = captain;'
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
    'README.md': '## ' + name
  };
}

// Handlers
var handlers = {

  createuser: function createuser() {
    program.prompt('username: ', function(username) {
      program.password('password: ', '*', function(password) {
        program.password('confirm password: ', '*', function(password2) {
          if(password != password2) {
            util.abort('Password do not match, bailing out.');
          }
          program.prompt('email: ', function(email) {
            var body = {username: username, password: password, isStaff: true, email: email};

            db.users.create(body, function(err) {
              if(err) {
                util.abort('Failed to created user', err);
              } else {
                util.exit('\nUser created!\n\n');
              }
            });
          });
        });
      });
    });
  },

  syncdb: function syncdb() {
    function fn(force) {
      db.syncDB({
        oncomplete: function(err) {
          if(err) {
            util.abort('Failed syncing', err);
          } else {
            util.exit('\nAll done\n\n');
          }
        },

        onprogress: function(script) {
          console.log('Running: \n========\n%s\n', script);
        },

        forceDrop: force
      });
    }

    if(program.force) {
      fn(true);
    } else {
      program.prompt('Force drop? (y/n): ', function(answer) {
        var force = !!answer.match(/y|yes|arrr/i);
        fn(force);
      });
    }
  },

  loaddata: function loaddata(filename) {
    if(filename === true) {
      program.help();
    }

    var files = [];

    if(isDirectory(filename)) {
      fs.readdirSync(filename).forEach(function(file) {
        files.push(path.join(filename, file));
      });
    } else {
      files.push(filename);
    }

    async.series(files.map(db.load), function(err){
      if(err) {
        util.abort('Failed loading data', err);
      } else {
        util.exit('\nAll done.\n\n');
      }
    });
  },

  init: function init(target) {
    function fn(name) {
      console.log();
      console.log(util.cyan('Creating project: ') + name);
      console.log();

      // Creating dirs
      dirs(name, ['assets', 'cache', 'media', 'logs']);

      // Creating files
      var templates = files(name);
      Object.keys(templates).forEach(function(key) {
        var p = path.join(name, key);
        write(p, templates[key]);
      });

      // Copying assets
      copyAssets(name, ['syndication.html']);

      // Installing theme
      installTheme(name, 'default', function(err) {
        if(err) {
          util.abort(err);
        } else {
          console.log();
          console.log(util.cyan('Installing theme: '), 'default');
        }

        // Instructions
        console.log();
        console.log(util.cyan('Now run: '));
        console.log(pad('cd ' + target));
        console.log(pad('captain run'));
      });
    }

    if(target === true) {
      program.help();
    }

    if(fs.existsSync(target) && !isEmptyDirectory(target) && !program.force) {
      program.prompt('Directory not empty, force create? (y/n): ', function(answer) {
        var forceCreate = !!answer.match(/y|yes|arrr/i);

        if(forceCreate) {
          fn(target);
        } else {
          util.abort('Cowardly refusing to init project in a non-empty directory');
        }
      });
    } else {
      fn(target);
    }
  },

  themes: function themes() {
    var themes = fs.readdirSync(path.join(PROJECT_ROOT, 'themes'));

    console.log(util.cyan('Available themes:'));
    console.log(themes.map(pad).join(os.EOL));
  },

  theme: function theme(target) {
    if(target === true) {
      program.help();
    }

    if(isCaptainProject()) {
        installTheme(target);
    } else {
      util.abort('Not a Captain project, aborting');
    }
  },

  run: function run() {
    if(isCaptainProject()) {
      var captain = require('../');
      captain.listen(3000);
    } else {
      util.abort('Not a Captain project, aborting');
    }
  }

};

var option = program.options
  .filter(function(option) {
    return !~option.long.indexOf('-');
  })
  .some(function(option) {
    var val = program[option.long];
    if(val) {
      handlers[option.long](val);
      return true;
    }
    return false;
  });

if(!option) {
  program.help();
}