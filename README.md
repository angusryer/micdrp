# micdrp monorepository

Micdrp is an app that brings your singing out of the shower and onto the stage using visual guidance and machine learning. 

## Motivation for this Project
I want have a meaningful and complex project to use as a showcase of my skills as a developer, and to have fun integrating the entire software lifecycle. Micdrp is also a passion project. The first version I made as the culminating activity of my web development diploma program at BrainStation. It was really simple, but it did the core task of measuring the pitch of your voice and displaying it as a line relative to a pitch that was being played back to you.

This version is a real, production-ready version of that project. I use Yarn workspaces. I use Linear to track bug, feature and story development, complete with Github integrations for public collaboration. The client uses React Native, written in TypeScript, Kotlin and Swift. The backend services are all written in TypeScript. I don't diligently practice test-driven development, but I tend to spend about 50% of my time writing tests before writing functional code and 50% of it writing functional code first. The app implements internationalization and uses Redis for local caching. Micdrp's deployment is fully automated via Github actions and custom scripts and is available on both the App Store and Google Play. The pipeline's progression depends on a sequence of passing tests, approved and successful PR merges, just as you might see in a production envrionment.

It's open source using licencing that allow me to sell the final product, yet permit it to be used elsewhere by anyone for any reason (hopefully not malicious).

Other notable things:
- Custom implementation of the auth flow, including custom native modules to support secure token storage
- Several audio-specific, hardware-optimized React Native modules were built to support fast audio processing and interaction between audio streams and React's work queuing and UI updating
- Modules developed for this app and its services are packaged and available on NPM 

## TODOs
[ ] Implement `git-secret` to store key stores and sensitive environment variables that are shared across the development team
[ ] Configure github actions to
    [ ] Install appropriate, version-controlled environment packages
    [ ] Run test suites
    [ ] Run build and deploy scripts, accessing git-secret environment variables
[ ] Install OWASP & licence checker, add to package.json
``` json
{
    "scripts": {
        "license": "license-checker --exclude 'MIT, MIT OR X11, BSD, ISC, Apache-2.0, Python-2.0, CC-BY-4.0' --excludePackages 'spdx-exceptions@2.3.0;spdx-license-ids@3.0.11'",
        "owasp": "dependency-check --project 'react-native' -s . --suppression ./owasp.suppression.xml"
    }
}
```

## Technologies used
- react native for the client
- node and express for the server
- git-secret for environment variable storage and sharing

### Each of the below commands should be run from the root directory unless otherwise specified

## Setting up the development environment
- Ask to be added to the `git-secret` allowed list so you can access environment variables
-- You'll be given a public key from an admin
- Install the `rvest.vs-code-prettier-eslint` VS Code extension and set it up as per its own directions
- Clone this repository and change to the cloned directory
- Run `yarn`

## Running the app and server locally
You can run a complete development environment, including the client app on iOS, Android or both, as well as the server using development, staging or production environment variables with the command below:
`yarn dev -e [s|p|d] ios|android|both`

## Testing
You can run all test suites across all packages in the monorepo with this command:
`yarn test`

If you want to run tests for a specific package, then do this:
`yarn test client`
`yarn test server`
`yarn test models`
`yarn test logic`

You can specify specific tests within each package, or across all workspaces by providing a basic regex, such as:
`yarn test /*some test description fragment*/`, or
`yarn test client /*some test description fragment*/`

## Building and/or Deploying
You can build and deploy to both the App Store and Google Play with this command:
`yarn build --deploy --e [s|p] [ios|android|both]`

This is will detect the current version of the app, increment it appropriately, and verify the app packages for you before deployment. By default the build number is incremented in all environments, and the maintenance number (0.0.X) is incremented for staging and production builds. If you would like to increment the minor (0.X.0) or major version numbers (X.0.0), you can. The command below will build, _not_ deploy, and bump up the minor version by 1.
`yarn build -me [s|p|d] [ios|android|both]`

This will raise the major version number by one:
`yarn build -Me [s|p|d] [ios|android|both]`

### Note that _only the build number will increment when specifying the `d` (developement) environment
