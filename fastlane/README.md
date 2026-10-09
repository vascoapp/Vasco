fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Upload metadata to App Store Connect (no build)

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

Upload screenshots to App Store Connect (no metadata, no binary)

### ios release

```sh
[bundle exec] fastlane ios release
```

Upload metadata + screenshots, prepare for submission

----


## Android

### android metadata

```sh
[bundle exec] fastlane android metadata
```

Upload Play Store listing metadata (no apk/aab)

### android release

```sh
[bundle exec] fastlane android release
```

Upload Play Store listing + feature graphic + screenshots (no apk/aab)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
