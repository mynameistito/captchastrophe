// Typed generic bindings work before deployment codegen; no fabricated generated files.
import { queryGeneric, mutationGeneric, internalMutationGeneric, internalActionGeneric, internalQueryGeneric, httpActionGeneric } from 'convex/server';
import type { DataModelFromSchemaDefinition, QueryBuilder, MutationBuilder, ActionBuilder, GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import schema from './schema';
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export const query: QueryBuilder<DataModel, 'public'> = queryGeneric;
export const mutation: MutationBuilder<DataModel, 'public'> = mutationGeneric;
export const internalMutation: MutationBuilder<DataModel, 'internal'> = internalMutationGeneric;
export const internalQuery: QueryBuilder<DataModel, 'internal'> = internalQueryGeneric;
export const internalAction: ActionBuilder<DataModel, 'internal'> = internalActionGeneric;
export const httpAction = httpActionGeneric;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type QueryCtx = GenericQueryCtx<DataModel>;
