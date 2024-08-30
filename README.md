# Introduction

[Commitspark](https://commitspark.com) is a set of tools to manage structured data with Git through a GraphQL API.

This repository holds code for a [Commitspark Git adapter](https://github.com/commitspark/git-adapter) that provides
access to Git repositories hosted on GitLab (SaaS).

# Usage

Instantiate the adapter with `createAdapter()` and then call `setRepositoryOptions()` with `GitLabRepositoryOptions` on
the instance. These options are as follows:

| Option name       | Required | Default value                       | Description                                     |
|-------------------|----------|-------------------------------------|-------------------------------------------------|
| `projectPath`     | True     |                                     | GitLab (SaaS) project path, e.g. `myorg/myrepo` |
| `token`           | True     |                                     | GitLab (SaaS) personal access token             |
| `pathSchemaFile`  | False    | `commitspark/schema/schema.graphql` | Path to schema file in repository               |
| `pathEntryFolder` | False    | `commitspark/entries/`              | Path to folder for content entries              |

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
