import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
export const direction = v.union(v.literal('up'), v.literal('down'), v.null());
export default defineSchema({
  users: defineTable({ githubId: v.string(), login: v.string(), avatarUrl: v.optional(v.string()), githubCreatedAt: v.optional(v.number()), suspended: v.boolean(), changes: v.array(v.number()) }).index('by_github', ['githubId']),
  submissions: defineTable({ id: v.string(), title: v.string(), status: v.union(v.literal('accepted'),v.literal('pre-review'),v.literal('removed')), addedAt: v.string(), up: v.number(), down: v.number(), top: v.number(), trending: v.number() }).index('by_stable_id',['id']),
  votes: defineTable({ userId: v.id('users'), submissionId: v.string(), direction, firstVotedAt: v.number(), updatedAt: v.number(), voided: v.boolean() }).index('by_user_submission',['userId','submissionId']).index('by_submission_first',['submissionId','firstVotedAt']).index('by_user',['userId']),
  voteDays: defineTable({ submissionId: v.string(), day: v.number(), up: v.number(), down: v.number() }).index('by_submission_day', ['submissionId','day']),
  audit: defineTable({ actor: v.string(), action: v.string(), target: v.string(), reason: v.string(), at: v.number() }).index('by_at',['at']),
});
