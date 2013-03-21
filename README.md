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
      ├─ conf/
      ├─ logs/
      ├─ media/
      ├─ themes/
      ├─ index.js
      ├─ package.json
      └─ README.md

The last step is to launch your application

    $ cd myblog
    $ captain run

The default port for Captain is 3000. If you visit http://localhost:3000 you
will see the welcome page.