# Revolt Desktop

## ⚠️ Deprecation notice ⚠️

This project will soon be deprecated in favour of a new desktop app built with Tauri. You can follow progress [here](https://github.com/revoltchat/frontend/issues/14).

## Description

This is a desktop application for Revolt built on Electron.

## Stack

-   [Electron](https://electronjs.org/)
-   [Electron Builder](https://www.electron.build/)

## Resources

### Revolt Desktop

-   [Revolt Desktop Issue Board](https://github.com/revoltchat/desktop/issues)

### Revolt

-   [Revolt Project Board](https://github.com/revoltchat/revolt/discussions) (Submit feature requests here)
-   [Revolt Testers Server](https://app.revolt.chat/invite/Testers)
-   [Contribution Guide](https://developers.revolt.chat/contributing)

## Quick Start

Get Revolt Desktop up and running locally.

```
git clone https://github.com/revoltchat/desktop
cd desktop
yarn
yarn build:bundle
yarn start
```

## CLI Commands

| Command             | Description                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| `yarn build:bundle` | Builds the application bundle from TypeScript files.                                |
| `yarn watch:bundle` | Watches TypeScript files for changes and rebuilds the application bundle on change. |
| `yarn start`        | Starts the application.                                                             |
| `yarn eb`           | Runs electron-builder.                                                              |
| `yarn release`      | Prepares a release. Requires a valid .env file.                                     |
| `yarn clean`        | Cleans the application bundle.                                                      |

There are also numerous OS-specific commands related to building and testing, all prefixed with `yarn`:

-   `build:linux` `build:mac`, `build:windows`
    -   Builds the application for the specified platform.

## License

Revolt Desktop is licensed under the [GNU Affero General Public License v3.0](https://github.com/revoltchat/desktop/blob/master/LICENSE).
