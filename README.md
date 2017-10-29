
Boilerplate: Static prototype
================================================================================

This is a simple boilerplate to start prototyping a site quickly.

It provides a ready made build script which compiles sass files, bundles scripts
and uses consolidate to render templates from a template engine of your choice.
It also comes with a browserSync watch mode for quick development.

## Initializing the project

Please use your own repository as a base for your project by downloading the
zip file without the `.git` folder from github or by cloning the repository
and stripping the git data:

	> git clone https://github.com/jfroehlich/boilerplate-static-prototype.git .
	> cd boilerplate-static-prototype
	> rm -rf .git

Then change all the values written in uppercase inside `package.json` to make the
project your own:

- **PROJECT_NAME:** The name for your prototype
- **PROJECT_DESCRIPTION:** What should be accomplished with the prototype
- **PROJECT_GIT_URL:** The url to the new git repository
- **PROJECT_AUTHOR_NAME_AND_EMAIL:** Your name and email e.g. `Eric Example <eric.example@example.com`
- **PROJECT_BUGS_URL:** The url to the projects bug tracker
- **PROJECT_HOMEPAGE_URL:** The projects homepage e.g. the github URL

Now create your new git project:

	> git init
	> git add .
	> git commit -m "Initial commit"

Finally you need to install the dependencies:

	> npm install

Now lets get started.

## Customizing your project

Instead of constantly changing the gulpfile script you can change most of your
settings in `config.json`. For all changes in the config file you need to restart
the watch task since the settings are not yet injected dynamically on the fly.

The objects of `base`, `source` and `target` can not be extended without touching
the gulpfile but you can change their values. Means that you can change where
the sources are read from and where they are written to.

The settings in `browserSync` are [the options to configure that tool](https://www.browsersync.io).

**Tip:** By default browserSync opens the page opens in your default browser
when you run the watch task but you can disable this behaviour by changing the
`open` option from `local` to `false`.

The `site` object is passed to your template when rendering them. It can be used
to define global values for general things like the sites name or the main paths.


## Building the project

We put a help text as the default task so you always have a reference at hand.
To get a quick head start here are the most important ones:

**Do a production run:**

	> gulp build --production

**Run the development server:**

	> gulp watch

**Empty the the destination folder:**

	> gulp clean
