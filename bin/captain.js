#!/usr/bin/env node
var fs = require('fs'),
    path = require('path'),
    join = path.join,
    resolve = path.resolve,
    dirname = path.dirname,
    spawn = require('child_process').spawn;

var program = require('commander'),
    async = require('async'),
    terminal = require('captain-core/lib/util/terminal'),
    helpers = require('../lib/helpers');

var pkg = require('../package.json'),
    cwd = process.cwd();

const PROJECT_ROOT = resolve(__dirname, '..');

program
  .version(pkg.version)
  .option('create_user', 'Creates a user account')
  .option('syncdb', 'Synchronize all models')
  .option('load_data [filename]', 'Loads data')
  .option('themes', 'Display available themes')
  .option('theme [theme]', 'Install theme')
  .option('run', 'Run captain project')
  .option('init [projectname]', 'Creates a new project')
  .option('-f, --force', 'Force operation (init, syncdb)')
  .option('-W, --watch', 'Watch for file changes (run)')
  .option('-F, --fork', 'Fork to background (run)')
  .parse(process.argv);


/**
 * Usage: captain create_user
 *
 * Creates a user
 *
 */

function create_user() {
  var db = require('captain-core/lib/db');

  program.prompt('username: ', function(username) {
    program.password('password: ', '*', function(password) {
      program.password('confirm password: ', '*', function(password2) {
        if(password != password2) {
          terminal.abort('Password do not match, bailing out.');
        }
        program.prompt('email: ', function(email) {
          var body = {username: username, password: password, email: email};

          db.users.create(body, function(err) {
            if(err) {
              terminal.abort('Failed to created user', err);
            } else {
              terminal.exit('\nUser created!\n\n');
            }
          });
        });
      });
    });
  });
}

/**
 * Usage: captain syncdb [--force]
 *
 * Synchronize all models
 *
 */

function syncdb() {
  var db = require('captain-core/lib/db');

  function fn(force) {
    db.syncDB({
      oncomplete: function(err) {
        if(err) {
          terminal.abort('Failed syncing', err);
        } else {
          terminal.exit('\nAll done\n\n');
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
}

/**
 * Usage: captain load_data <path>
 *
 * Loads <path> if a file, or each files in <path> if a directory
 *
 */

function load_data(filename) {
  var files = [],
      db = require('captain-core/lib/db');

  if(filename === true) {
    program.help();
  }

  if(helpers.isDirectory(filename)) {
   fs.readdirSync(filename).forEach(function(file) {
      files.push(join(filename, file));
    });
  } else {
    files.push(filename);
  }

  async.series(files.map(db.load), function(err){
    if(err) {
      terminal.abort('Failed loading data', err);
    } else {
      terminal.exit('\nAll done.\n\n');
    }
  });
}

/**
 * Usage: captain init <name> [--force]
 *
 * Creates a new project.
 * Use --force if directory <name> already exists
 *
 */

function init(target) {
  function fn(name) {
    console.log();
    console.log(terminal.cyan('Creating project: ') + name);
    console.log();

    // Creating dirs
    helpers.dirs(name, ['cache', 'media', 'logs', 'themes']);

    // Copying files
    helpers.copyR([join('themes','default')],  name);

    // Creating files
    var templates = helpers.files(name);
    Object.keys(templates).forEach(function(key) {
      var p = join(name, key),
          dir = dirname(key);
      if(dir != '.') {
        helpers.mkdir(join(name, dir));
      }
      helpers.write(p, templates[key]);
    });

    // Instructions
    console.log();
    console.log(terminal.cyan('Now, configure postgres server and run: '));
    console.log(helpers.pad('cd ' + target));
    console.log(helpers.pad('captain syncdb'));
    console.log(helpers.pad('captain run'));
  }

  if(target === true) {
      program.help();
  }

  if(helpers.exists(target) && !helpers.isEmptyDirectory(target) && !program.force) {
    program.prompt('Directory not empty, force create? (y/n): ', function(answer) {
      var forceCreate = !!answer.match(/y|yes|arrr/i);

      if(forceCreate) {
        fn(target);
      } else {
        terminal.abort('Cowardly refusing to init project in a non-empty directory');
      }
    });
  } else {
    fn(target);
  }
}

/**
 * Usage: captain themes
 *
 * Lists available themes
 *
 */

function themes() {
  var themes = fs.readdirSync(join(PROJECT_ROOT, 'themes'));

  console.log(terminal.cyan('Available themes:'));
  console.log(themes.map(helpers.pad).join(helpers.EOL));
}

/**
 * Usage: captain theme <theme>
 *
 * Install theme
 *
 */

function theme(target) {
  if(target === true) {
    program.help();
  }

  if(helpers.isCaptainProject()) {
    helpers.copyR([join('themes', target)],  '.');
  } else {
    terminal.abort('Not a Captain project');
  }
}

/**
 * Usage: captain run[--watch] [--fork]
 *
 * Runs captain project
 *
 * * Use --watch to restart
 * * Use --fork to create a daemon
 *
 * When using --fork, captain will redirect
 * stdout to logs/out.log, stderr to logs/err.log,
 * and write the process' pid to node.pid.
 *
 */

function run() {
  process.env['NODE_PATH'] = resolve(PROJECT_ROOT, '..');

  // TODO: Put this in settings
  var logs = join(cwd, 'logs'),
      out = fs.openSync(join(logs, 'out.log'), 'a'),
      err = fs.openSync(join(logs, 'err.log'), 'a');

  if(helpers.isCaptainProject()) {
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
    terminal.abort('Not a Captain project');
  }
}

// Handlers
var handlers = {
  create_user: create_user,
  syncdb: syncdb,
  load_data: load_data,
  init: init,
  themes: themes,
  theme: theme,
  run: run
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