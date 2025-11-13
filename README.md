# Introduction

[Commitspark](https://commitspark.com) is a set of tools to manage structured data with Git through a GraphQL API.

This repository holds code for a [Commitspark Git adapter](https://github.com/commitspark/git-adapter) that provides
access to Git repositories hosted on GitLab (SaaS).

# Installation

```shell
npm i @commitspark/git-adapter-gitlab
```

# Usage

Instantiate the adapter with `createAdapter()`, providing `GitLabRepositoryOptions` with the following parameters:

| Option name       | Required | Default value                       | Description                                     |
|-------------------|----------|-------------------------------------|-------------------------------------------------|
| `projectPath`     | True     |                                     | GitLab (SaaS) project path, e.g. `myorg/myrepo` |
| `token`           | True     |                                     | GitLab (SaaS) personal access token             |
| `pathSchemaFile`  | False    | `commitspark/schema/schema.graphql` | Path to schema file in repository               |
| `pathEntryFolder` | False    | `commitspark/entries/`              | Path to folder for content entries              |

# Example

To use this adapter together with the Commitspark GraphQL API library, your code could be the following:

```typescript
import { createAdapter } from '@commitspark/git-adapter-gitlab'
import { createClient } from '@commitspark/graphql-api'

const gitLabAdapter = createAdapter({
  projectPath: process.env.GITLAB_PROJECT_PATH,
  token: process.env.GITLAB_PERSONAL_ACCESS_TOKEN,
})

const client = await createClient(gitLabAdapter)
```

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
