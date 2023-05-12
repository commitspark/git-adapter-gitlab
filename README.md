# Introduction

**[Commitspark](https://commitspark.com) is a workflow-first Content Management System based on Git and GraphQL.**

This repository holds code that implements access to Git repositories hosted on GitLab (SaaS).

# Usage

Instantiate the adapter with `createAdapter()` and then call `setRepositoryOptions()` with `GitLabRepositoryOptions` on
the instance. These options are as follows:

| Option name       | Required | Default value           | Description                                     |
|-------------------|----------|-------------------------|-------------------------------------------------|
| `projectPath`     | True     |                         | GitLab (SaaS) project path, e.g. `myorg/myrepo` |
| `token`           | True     |                         | GitLab (SaaS) personal access token             |
| `pathSchemaFile`  | False    | `schema/schema.graphql` | Path to schema file in repository               |
| `pathEntryFolder` | False    | `entries/`              | Path to folder for content entries              |

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
