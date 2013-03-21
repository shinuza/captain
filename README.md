# Captain

## Requirements

  * node.js > 0.6 < 0.10
  * postgreSQL > 8

## Getting started

With node installed ([download](http://nodejs.org/download/)), you will need the `captain` executable

    $ sudo npm install captain -g

Then you will need to create a new project

    $ captain init myblog

This will create the project folder structure, which looks like this:

    $ ls myblog
    └─┬  assets/
      ├─ cache/
      ├┬ conf/
      │└ development.js
      ├─ logs/
      ├─ media/
      ├─ themes/
      ├─ index.js
      ├─ package.json
      └─ README.md

You need to edit the `db` value in the configuration file so captain can connect to your postgreSQL server.
Once down, run:

    $ cd myblog
    $ captain syncdb
    $ captain run

The default port for Captain is 3000. If you visit http://localhost:3000 you
will see the welcome page.