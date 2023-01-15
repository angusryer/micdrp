# micdrp monorepository

micdrp is an app that brings your singing out of the shower and onto the stage using visual guidance and machine learning. 

## TODOs
[ ] Install OWASP & licence checker, add to package.json
``` json
{
    "scripts": {
        "license": "license-checker --exclude 'MIT, MIT OR X11, BSD, ISC, Apache-2.0, Python-2.0, CC-BY-4.0' --excludePackages 'spdx-exceptions@2.3.0;spdx-license-ids@3.0.11'",
        "owasp": "dependency-check --project 'react-native' -s . --suppression ./owasp.suppression.xml"
    }
}
```

### Each of the below commands should be run from the root directory unless otherwise specified

## Quick reference for commands
`yarn install` - install all packages across all repositories
`yarn run` - run the server and app locally
`yarn build` - bundle and minify the app, output final build files to /dist
`yarn test` - run tests for all packages within the monorepo

## Setting up the development environment

## Running the app and server locally

## Testing

## Deploying