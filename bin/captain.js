#!/usr/bin/env node
var fs = require('fs'),
  os = require('os'),
  path = require('path'),
  crypto = require('crypto'),
  join = path.join,
  resolve = path.resolve,
  dirname = path.dirname,
  spawn = require('child_process').spawn;

var program = require('commander'),
    async = require('async'),
    //TODO: Rename util -> terminal, move util/console -> util/terminal
    util = require('captain-core/lib/util/console'),
    uuid = require('captain-core/lib/util').uuid;

var PKG = require('../package.json');
var VERSION = PKG.version;
var PROJECT_NAME = PKG.name;
var cwd = process.cwd();

const PROJECT_ROOT = resolve(__dirname, '..');

program
  .version(VERSION)
  .option('createuser', 'Creates a user account')
  .option('syncdb', 'Synchronise all definitions')
  .option('loaddata [filename]', 'Loads data')
  .option('themes', 'Display available themes')
  .option('theme [theme]', 'Install theme')
  .option('run', 'Run captain project')
  .option('init [projectname]', 'Creates a new project')
  .option('-f, --force', 'Force operation (init, syncdb)')
  .option('-W, --watch', 'Watch for file changes (run)')
  .option('-F, --fork', 'Fork to background (run)')
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
  write(_out, fs.readFileSync(_in));
}

/**
 * Mkdir -p
 *
 * @param {String} path
 */

function mkdir(path) {
  if(!fs.existsSync(path)) {
    fs.mkdirSync(path, 0755);
    console.log(util.cyan(pad('create : ')) + path);
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
    mkdir(join(base, sub));
  });
}

/**
 * Like cp -R
 *
 */

function copyR(files, target) {
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
}

// Templates

function files(name) {
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
}

// Handlers
var handlers = {

  createuser: function createuser() {
    var db = require('captain-core/lib/db');

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
    var db = require('captain-core/lib/db');

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
    var db = require('captain-core/lib/db');

    if(filename === true) {
      program.help();
    }

    var files = [];

    if(isDirectory(filename)) {
      fs.readdirSync(filename).forEach(function(file) {
        files.push(join(filename, file));
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
      dirs(name, ['cache', 'media', 'logs', 'themes']);

      // Copying files
      copyR([join('themes','default')],  name);

      // Creating files
      var templates = files(name);
      Object.keys(templates).forEach(function(key) {
        var p = join(name, key),
            dir = dirname(key);
        if(dir != '.') {
          mkdir(join(name, dir));
        }
        write(p, templates[key]);
      });

      // Instructions
      console.log();
      console.log(util.cyan('Now, configure postgres server and run: '));
      console.log(pad('cd ' + target));
      console.log(pad('captain syncdb'));
      console.log(pad('captain run'));
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
    var themes = fs.readdirSync(join(PROJECT_ROOT, 'themes'));

    console.log(util.cyan('Available themes:'));
    console.log(themes.map(pad).join(os.EOL));
  },

  theme: function theme(target) {
    if(target === true) {
      program.help();
    }

    if(isCaptainProject()) {
      copyR([join('themes', target)],  '.');
    } else {
      util.abort('Not a Captain project');
    }
  },

  run: function run() {
    process.env['NODE_PATH'] = resolve(PROJECT_ROOT, '..');

    // TODO: Put this in settings
    var logs = join(cwd, 'logs'),
      out = fs.openSync(join(logs, 'out.log'), 'a'),
      err = fs.openSync(join(logs, 'err.log'), 'a');

    if(isCaptainProject()) {
      var bin = program.watch
        ? resolve(PROJECT_ROOT, 'node_modules', '.bin', 'node-dev')
        : 'node';

      var options = program.fork
        ? { stdio: [ 'ignore', out, err ],  detached: true}
        : { stdio: 'inherit' };

      var child = spawn(bin, [join(cwd, 'index.js')], options);

      if(program.fork) {
        // TODO: Put this in settings
        fs.writeFileSync(join(cwd, 'node.pid'), String(child.pid));
        child.unref();
      }

    } else {
      util.abort('Not a Captain project');
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