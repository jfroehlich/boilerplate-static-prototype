
Boilerplate: Static prototype
================================================================================

This is a simple boilerplate to start prototyping a site quickly.

## Installation

	> $ npm install

## Development server

You can run a local server for development. Every time you save a CSS, JS,
template or content file, the page in the browser will be updated.

The development server will serve from `builds/development`. Script and styles
in this folder are not compressed to simplify debugging.

	> $ gulp develop

## Production build

To create a production build you need to set the production environment
explicitly. A production build will put the files into `builds/production`.

In contrast to the development build, scripts and styles are compressed in
production builds.

	> $ gulp --env=production
