#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , join = path.join
  , resolve = path.resolve
  , dirname = path.dirname
  , spawn = require('child_process').spawn

  , program = require('commander')
  , async = require('async')
  , terminal = require('captain-core/lib/util/terminal')
  , helpers = require('../lib/helpers')
  , pkg = require('../package.json')
  , cwd = process.cwd();

const PROJECT_ROOT = resolve(__dirname, '..');

program
  .version(pkg.version)
  .option('create_user', 'Creates a user account')
  .option('syncdb [options]', 'Synchronize all models')
  .option('load_data [filename]', 'Loads data')
  .option('themes', 'Display available themes')
  .option('theme [theme]', 'Install theme')
  .option('run', 'Run captain project')
  .option('init [projectname]', 'Creates a new project')
  .option('--force', 'Force operation (init, syncdb)')
  .option('--drop', 'Drop databases (syncdb)')
  .option('-W, --watch', 'Watch for file changes (run)')
  .option('--fork', 'Fork to background (run)')
  .option('--verbose', 'Verbose output')
  .parse(process.argv);


/**
 * Usage: captain create_user
 *
 * Creates a user
 *
 */

function create_user(options) {
  options = options || {};

   var success = options.success || function() {
     terminal.exit('\nUser created!\n\n');
   }, error = options.error || function(err) {
     terminal.abort('Failed to created user', err);
   };

  program.prompt('username: ', function(username) {
    program.password('password: ', '*', function(password) {
      program.password('confirm password: ', '*', function(password2) {
        if(password != password2) {
          terminal.abort('Password do not match, bailing out.');
        }
        program.prompt('email: ', function(email) {
          var body = {username: username, password: password, email: email}
            , db = require('captain-core/lib/db');

          db.users.create(body, function(err) {
            if(err) {
              error(err);
            } else {
              success();
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
  function _syncdb(drop) {
    var db = require('captain-core/lib/db');

    db.syncDB({
      complete: function(err) {
        if(err) {
          terminal.abort('Failed syncing', err);
        } else {
          terminal.exit('\nAll done\n\n');
        }
      },
      progress: function(script, file) {
        console.log('Executing:', file);
        if(program.verbose) {
          console.log('========\n%s\n', script);
        }
      },
      drop: drop
    });
  }

  if(program.drop) {
    if(!program.force) {
      program.prompt('This will drop all databases, are you sure you want to proceed? (y/N): ', function(answer) {
        if(!!answer.match(/y|yes|arrr/i)) {
          fn(true);
        } else {
          terminal.exit('Exiting.');
        }
      });
    } else {
      _syncdb(true);
    }
  } else {
    _syncdb(false);
  }
}

/**
 * Usage: captain load_data <path>
 *
 * Loads <path> if a file, or each files in <path> if a directory
 *
 */

function load_data(filename) {
  var files = []
    , db = require('captain-core/lib/db');

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

function prompt_uri(cb) {
  console.log();
  program.prompt(
    'Please enter the connection uri to PostgreSQL in\nthe form of ' +
    'pg://username:password@hostname/database: ', function(answer) {
      helpers.connectionTest(answer, function(err, success) {
        console.log();
        if(err) {
          console.error(terminal.red('Connection test failed'));
          console.error(terminal.red(err.message));
          prompt_uri(cb);
        }
        if(success === true) {
          cb(answer);
        }
      });
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

  function create_project(name, uri) {
    console.log();
    console.log(terminal.cyan('Creating project: ') + name);
    console.log();

    // Creating dirs
    helpers.dirs(name, ['cache', 'media', 'logs', 'themes']);

    // Copying files
    helpers.copyR([join('themes','default')],  name);

    // Creating files
    var templates = helpers.files({
      name: name,
      uri: uri
    });

    Object.keys(templates).forEach(function(key) {
      var p = join(name, key),
          dir = dirname(key);

      if(dir != '.') {
        helpers.mkdir(join(name, dir));
      }
      helpers.write(p, templates[key]);
    });
  }

  if(target === true) {
      program.help();
  }

  function _init() {
    console.log();
    console.log(terminal.cyan('Initializing project: ') + target);
    // Testing connection
    prompt_uri(function(uri) {
      console.info(terminal.cyan('Connection successful!'));
      console.log();
      console.info(terminal.cyan('Creating database schema...'));

      // Creating projects files
      create_project(target, uri);

      // Synchronizing database
      var db = require('captain-core/lib/db');
      var conf = require('captain-core').conf;


      conf.reload(join(cwd, target));
      db.syncDB({
        uri: uri,
        complete: function(err) {
          if(err) {
            terminal.abort(err);
          }
          console.log();
          console.info(terminal.cyan('Done!'));
          console.log();
          console.info(terminal.cyan('Creating first user...'));
          console.log();

          // Creating user
          create_user({
            no_commit: true,
            success: function() {

              // Instructions
              console.log();
              console.info(terminal.cyan('Done!'));
              console.log();
              console.info(terminal.cyan('Now run:'));
              console.log(helpers.pad('cd ' + target));
              console.log(helpers.pad('captain run'));
              terminal.exit('');
            }
          });
        }
      });
    });
  }

  if(helpers.exists(target) && !helpers.isEmptyDirectory(target) && !program.force) {
    program.prompt('Directory not empty, force create? (y/n): ', function(answer) {
      var forceCreate = !!answer.match(/y|yes|arrr/i);

      if(forceCreate) {
        _init();
      } else {
        terminal.abort('Cowardly refusing to init project in a non-empty directory');
      }
    });
  } else {
    _init();
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

  helpers.countUsers(function(err, count) {
    if(err) { throw err; }
    if(count > 0) {
      _run();
    } else {
      terminal.abort('You need to create at least one user with `captain create_user`');
    }
  });


  function _run() {
    // TODO: Put this in settings
    var logs = join(cwd, 'logs')
      , out = fs.openSync(join(logs, 'out.log'), 'a')
      , err = fs.openSync(join(logs, 'err.log'), 'a');

    if(helpers.isCaptainProject()) {
      var bin = program.watch
        ? resolve(PROJECT_ROOT, 'node_modules', '.bin', 'node-dev')
        : 'node';

      var options = program.fork
        ? { stdio: [ 'ignore', out, err ],  detached: true}
        : { stdio: 'inherit' };

      var child = spawn(bin, [join(cwd, 'index.js')], options);
      var conf = require('captain-core').conf;
      console.log(terminal.cyan('Your application is running at: ') + 'http://%s:%d', conf.host, conf.port);

      if(program.fork) {
        // TODO: Put this in settings
        fs.writeFileSync(join(cwd, 'node.pid'), String(child.pid));
        child.unref();
      }
    } else {
      terminal.abort('Not a Captain project');
    }
  }
}

// Handlers
var handlers = {
    create_user: create_user
  , syncdb: syncdb
  , load_data: load_data
  , init: init
  , themes: themes
  , theme: theme
  , run: run
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