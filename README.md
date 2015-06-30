# ChromNet.js
ChromNet web client front end. http://chromnet.cs.washington.edu

## Building

A recent version of [NodeJS](nodejs.org) in required to build the ChromNet client interface. All required NodeJS packages are listed in `package.json` and can ben installed using the NodeJS package manager from the top level directory using:

```bash
npm install
```

Client Javascript packages are managed by [Bower](bower.io), and can be installed from the top level directory using:

```bash
bower install
```

[Grunt](gruntjs.com) is used to run the build tasks. To start a local development server for the code use:

```bash
grunt serve
```

## Javascript libraries

The primary javascript libraries used by the ChromNet interface are [AngularJS](angularjs.org) and [D3](d3js.org). Familarity with both of these packages is important to understanding the code.
