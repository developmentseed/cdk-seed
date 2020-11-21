# cdk-seed :seedling:

## Development

### Prerequisites

- [nvm](https://github.com/nvm-sh/nvm)

### Getting started

Use the specified version of Node for this project:

`nvm use`

If you get an error that the version of node is not installed, run:

`nvm install $(cat .nvmrc)`

### Commands

#### `npm start`

Watch packages for updates to code and documentation, triggering builds of both on change.

#### `npm run bootstrap`

Install dependencies for each package.

#### `npm run build`

Build each package.

#### `npm run package`

Prepare each package for distribution.

#### `npm run docgen`

Generate documentation for each package.

#### `npm test`

Run tests for all packages.

## Adding packages

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Generating documentation

The generation of our documentation website is a three part process:

1. `jsii` must be run within each package (this is done by running `npm run build` from the project base dir). This produces a `.jsii` in the root of each package.
2. `scripts/docgen.js` should be run to gather each package's `.jsii` file and to export markdown documentation for each package into the `site/docs` directory.
3. [Jekyll](https://jekyllrb.com/) should be run to generate HTML from the markdown documentation.

This process can be made easier by running two processes in separate terminals:

1. `npm start` which concurrently runs two operations:
   * trigger `jsii` builds on changes to packages' `README.md` or `lib/*.ts` files.
   * trigger `scripts/docgen.js` to run on changes to packages' `.jsii` files.
2. `npm run website` which starts the Jekyll server. It is assumed that Jekyll has been previously installed on the system. See [Jekyll's documentation](https://jekyllrb.com/docs/installation/) for more information.
