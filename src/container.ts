import { ContentEntriesToActionsConverterService } from './content-entries-to-actions-converter.service'
import { GitLabAdapterService } from './git-lab-adapter.service'
import { GraphqlQueryFactoryService } from './graphql-query-factory.service'
import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'

const cachedHttpAdapter = setupCache(axios.create(), {
  ttl: GitLabAdapterService.QUERY_CACHE_SECONDS * 1000, // milliseconds
  methods: ['get', 'post'],
})

const graphqlQueryFactoryService = new GraphqlQueryFactoryService()
const contentEntriesToActionsConverterService =
  new ContentEntriesToActionsConverterService()

export const gitLabAdapterService = new GitLabAdapterService(
  cachedHttpAdapter,
  graphqlQueryFactoryService,
  contentEntriesToActionsConverterService,
)
