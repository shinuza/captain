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

## Dependencies and Compatibility

  * node.js >= 0.6
  * postgreSQL > 8

Note: Captain have not been tested on windows, and may not work properly

## License

### The MIT License

Copyright (c) 2009-2011 TJ Holowaychuk <tj@vision-media.ca>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.