# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.22.0] - 2026-02-27

### Changed

- Upgrade to @commitspark/git-adapter 1.0.0

## [0.21.0] - 2026-02-26

### Changed

- Upgrade to @commitspark/git-adapter 0.30.0

## [0.20.1]

### Fixed

- Fix incorrect ESM build configuration leading to broken build output

## [0.20.0]

### Changed

- Upgrade to `@commitspark/git-adapter` 0.20.0 and simplify adapter instantiation

## [0.12.2] - 2025-09-16

### Changed

- Upgrade dependencies

## [0.12.1] - 2025-04-16

### Fixed

- Fix incorrect types export

### Changed

- Improve library exports

## [0.12.0] - 2025-04-13

### Changed

- Refactor library packaging to support ESM and CJS
- Clean up dependencies and relax version constraints

## [0.11.0] - 2024-08-30

### Changed

- Upgrade to `@commitspark/git-adapter` 0.13.0
- Update dependencies

## [0.10.0] - 2023-12-12

### Changed

- Add eslint
- Upgrade to `@commitspark/git-adapter` 0.10.0 with new default directories
- Reduce number of files included in NPM package

### Fixed

- Fix lint errors
- Switch to GraphQL query variables to prevent string escaping issues
- Fix build process to include only relevant files

## [0.9.0] - 2023-05-12

### Changed

- Rename organization

### Fixed

- Update `yaml` library to address [security advisory](https://github.com/advisories/GHSA-f9xv-q969-pqx4)

## [0.8.1] - 2023-04-28

### Fixed

- Remove package.lock development code pollution

## [0.8.0] - 2023-04-28

### Changed

- Replace constructor use with object literals to prevent polluting DTOs with prototype function
- Update to Git Adapter interface 0.7.0

## [0.7.2] - 2023-03-15

### Changed

- Remove dependency injection package to support bundling with webpack & co.

## [0.7.1] - 2023-03-12

### Changed

- Update dependencies

### Fixed

- Fixed inadvertent use of HTTP cache for some requests

## [0.7.0] - 2022-12-13

### Added

- Expose schema file path and entries folder path as repository options

### Changed

- Update adapter documentation in README

## [0.6.0] - 2022-11-01

### Changed

- Move NPM package to organization namespace
- Update to organization-based `git-adapter`

## [0.5.0] - 2022-10-25

### Changed

- Update to Git Adapter interface 0.4.0

## [0.4.0] - 2022-10-24

### Changed

- Drop NestJS in favor of awilix due to https://github.com/nestjs/nest/issues/9622

## [0.3.0] - 2022-10-05

### Fixed

- Fix errors exposed by strict types
- Fix NPM package content

## [0.2.0] - 2022-10-05

### Added

- Initial release
