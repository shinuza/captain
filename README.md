## Getting started

With node installed ([download](http://nodejs.org/download/)), you will need the `captain` executable

    $ sudo npm install captain -g

Then you will need to create a new project

    $ captain init myblog

This will create the project folder structure, which looks like this:

    $ ls myblog
    └─┬  cache/
      ├─ logs/
      ├─ media/
      ├─ index.js
      ├─ package.json
      └─ README.md

The last step is to launch your application

    $ cd myblog
    $ node index.js

The default port for Captain is 3000. If you visit http://localhost:3000 you
will see the installation page.