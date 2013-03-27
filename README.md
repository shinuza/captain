Captain.js is simple, yet powerful blog engine for node.js.
It's extensible, fast and features a RESTful API with smart content negotiation.

## Getting started

With node installed ([download](http://nodejs.org/download/)), you will need the `captain` executable

```sh
$ sudo npm install captain -g
```

Then you will need to create a new project

```sh
$ captain init myblog
$ cd myblog
```

Then edit the `db` value in the configuration file (conf/development.js), and run:

```sh
$ captain syncdb
$ captain create_user
```

Follow the instructions, and finally:

```sh
$ captain run
```

The default port for Captain is 3000.
If you visit http://localhost:3000 you will see the welcome page.

## Requirements

  * node.js >= 0.6 < 0.10
  * postgreSQL > 8

Note: Captain have not been tested on windows