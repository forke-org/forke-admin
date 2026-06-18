import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['developer', 'owner'])
export const taskStatusEnum = pgEnum('task_status', [
  'open',
  'claimed',
  'submitted',
  'approved',
  'disputed',
])
export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'approved',
  'rejected',
])
export const escrowStatusEnum = pgEnum('escrow_status', [
  'held',
  'released',
  'refunded',
])
export const blogStatusEnum = pgEnum('blog_status', ['draft', 'published'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  githubAvatarUrl: text('github_avatar_url'),
  googleAvatarUrl: text('google_avatar_url'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').default('developer').notNull(),
  level: integer('level').default(1).notNull(),
  xp: integer('xp').default(0).notNull(),
  githubUrl: text('github_url'),
  bio: text('bio'),
  headline: text('headline'),
  location: text('location'),
  websiteUrl: text('website_url'),
  linkedinUrl: text('linkedin_url'),
  githubStats: jsonb('github_stats'),
  lastLoginAt: timestamp('last_login_at'),
  currentStreak: integer('current_streak').default(0).notNull(),
  isApproved: boolean('is_approved').default(false).notNull(),
  isBanned: boolean('is_banned').default(false).notNull(),
  emailAlerts: boolean('email_alerts').default(true),
  slackWebhooks: boolean('slack_webhooks').default(false),
  college: text('college'),
  deletionScheduledAt: timestamp('deletion_scheduled_at'),
  attribution: jsonb('attribution'), // first-touch marketing attribution { source, medium, campaign, referrer, landingPage, signupRole }
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  contactNumber: text('contact_number').notNull(),
  contactEmail: text('contact_email').notNull(),
  companyName: text('company_name').notNull(),
  companyWebsite: text('company_website'),
  personalLinkedIn: text('personal_linkedin').notNull(),
  companyLinkedIn: text('company_linkedin').notNull(),
  designation: text('designation').notNull(),
  otherLinks: text('other_links'),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  username: text('username').unique(),
  passwordHash: text('password_hash'),
  role: text('role').default('admin').notNull(),
  alternativeEmail: text('alternative_email'),
  inviteToken: text('invite_token').unique(),
  inviteExpiresAt: timestamp('invite_expires_at'),
  isDisabled: boolean('is_disabled').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const accounts = pgTable(
  'account',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'oauth' | 'oidc' | 'email'>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: {
      columns: [account.provider, account.providerAccountId],
      primaryKey: true,
    },
  })
)

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})



export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  budget: integer('budget').notNull(), // Stored in paise
  currency: text('currency').default('INR').notNull(),
  status: taskStatusEnum('status').default('open').notNull(),
  skillTags: text('skill_tags').array(),
  clientId: uuid('client_id')
    .references(() => users.id)
    .notNull(),
  claimantId: uuid('claimant_id').references(() => users.id),
  claimedAt: timestamp('claimed_at'),
  deadline: timestamp('deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .references(() => tasks.id)
    .notNull(),
  developerId: uuid('developer_id')
    .references(() => users.id)
    .notNull(),
  githubLink: text('github_link').notNull(),
  note: text('note'),
  status: submissionStatusEnum('status').default('pending').notNull(),
  rating: integer('rating'), // 1-5 scale
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const escrow = pgTable('escrow', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .references(() => tasks.id)
    .unique()
    .notNull(),
  amount: integer('amount').notNull(),
  status: escrowStatusEnum('status').default('held').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const revisionRequests = pgTable('revision_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .references(() => tasks.id)
    .notNull(),
  clientNote: text('client_note').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Note: github_profiles table has been merged into developers table below.

export const supportEnquiries = pgTable('support_enquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  contactNumber: text('contact_number').notNull(),
  contactEmail: text('contact_email').notNull(),
  message: text('message').notNull(),
  relevantLinks: text('relevant_links'),
  errorType: text('error_type'),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source').notNull().default('direct'), // primary, queryable marketing channel
  attribution: jsonb('attribution'), // full first-touch blob { medium, campaign, referrer, landingPage }
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Audit trail of admin actions (the "activity terminal" in the admin panel).
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),                       // admin who did it (null = system)
  actorName: text('actor_name'),                   // snapshot of the admin's name
  category: text('category').notNull().default('admin'), // admin | user | db | system | error
  action: text('action').notNull(),                // e.g. owner.approved, developer.banned
  target: text('target'),                          // human-readable subject (email / name / table)
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  githubId: text('github_id').unique(),
  username: text('username'),
  accessToken: text('access_token'),
  avatarUrl: text('avatar_url'),
  profileUrl: text('profile_url'),
  repos: jsonb('repos'),
  languages: jsonb('languages'),
  rawProfile: jsonb('raw_profile'),
  isGithubConnected: boolean('is_github_connected').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  isReceived: boolean('is_received').default(false).notNull(),
  isSeen: boolean('is_seen').default(false).notNull(),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // e.g. 'task_claimed', 'submission_received', 'message', 'payment', etc.
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'), // optional deep-link (e.g. /tasks/123)
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sqlQueryRequests = pgTable('sql_query_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id')
    .references(() => admins.id, { onDelete: 'cascade' })
    .notNull(),
  queryText: text('query_text').notNull(),
  status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedBy: uuid('reviewed_by').references(() => admins.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  executionDurationMs: integer('execution_duration_ms'),
  executionResults: jsonb('execution_results'),
  executionError: text('execution_error'),
})

// Blog posts authored in the admin portal's Medium-style editor.
// `content` holds Tiptap's structured JSON (the source of truth, queryable/re-editable);
// `contentHtml` is the rendered HTML snapshot used by the public reader to avoid
// re-serializing JSON on every page view. `coverImage` and inline images are URLs —
// currently pasted by hand, later produced by the R2 upload pipeline.
export const blogs = pgTable('blogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').references(() => admins.id, { onDelete: 'set null' }),
  authorName: text('author_name'),                 // snapshot of the author's name at write time
  title: text('title').notNull().default('Untitled'),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),                         // short summary for cards / SEO
  coverImage: text('cover_image'),                 // URL (R2 later)
  content: jsonb('content'),                       // Tiptap JSON document
  contentHtml: text('content_html'),               // rendered HTML snapshot
  status: blogStatusEnum('status').default('draft').notNull(),
  readingMinutes: integer('reading_minutes').default(1).notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Sandbox Owners (GitHub users who import repos) ───────────────────────────

export const sandboxOwners = pgTable('sandbox_owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').notNull().unique(),
  username: text('username').notNull(),
  accessToken: text('access_token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Sandbox Repos (Mirrors of owner repos managed by Forke) ──────────────────

export const sandboxRepos = pgTable('sandbox_repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .references(() => sandboxOwners.id, { onDelete: 'cascade' })
    .notNull(),
  sourceRepo: text('source_repo').notNull(),       // e.g. "owner/original-repo"
  sandboxRepo: text('sandbox_repo').notNull(),      // e.g. "forke-sandbox/owner-repo-mirror"
  // Task metadata — filled in via Configure Task form
  taskTitle: text('task_title'),
  taskDescription: text('task_description'),
  frontendStack: text('frontend_stack'),
  backendStack: text('backend_stack'),
  allowedPaths: text('allowed_paths'),              // Comma/newline-separated glob patterns
  restrictedPaths: text('restricted_paths'),        // Comma/newline-separated glob patterns
  acceptanceCriteria: text('acceptance_criteria'),
  verificationStatus: text('verification_status').default('verifying').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Developer Forks (Developers who fork sandbox repos) ──────────────────────

export const developerForks = pgTable('developer_forks', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubUsername: text('github_username').notNull(),
  sandboxRepo: text('sandbox_repo').notNull(),
  forkUrl: text('fork_url').notNull(),
  prUrl: text('pr_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Sandbox Developers (GitHub users who do tasks) ───────────────────────────

export const sandboxDevelopers = pgTable('sandbox_developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').notNull().unique(),
  username: text('username').notNull(),
  accessToken: text('access_token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Baseline Snapshots (Deterministic health check of base branch) ───────────

export const baselineSnapshots = pgTable('baseline_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxRepoId: uuid('sandbox_repo_id')
    .references(() => sandboxRepos.id, { onDelete: 'cascade' })
    .notNull(),
  branch: text('branch').notNull(),
  commitSha: text('commit_sha').notNull(),
  techStack: text('tech_stack'),      // JSON string of DetectedStack
  results: text('results'),           // JSON string of 12 deterministic test results
  aiSummary: text('ai_summary'),      // JSON string of Gemini baseline diagnostic
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Review Results (Deterministic PR review with baseline comparison) ─────────

export const reviewResults = pgTable('review_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  prNumber: integer('pr_number').notNull(),
  sandboxRepoId: uuid('sandbox_repo_id')
    .references(() => sandboxRepos.id, { onDelete: 'cascade' })
    .notNull(),
  commitSha: text('commit_sha').notNull(),
  baselineSnapshotId: uuid('baseline_snapshot_id')
    .references(() => baselineSnapshots.id, { onDelete: 'set null' }),
  results: text('results').notNull(),       // JSON of PR deterministic test results
  comparison: text('comparison').notNull(), // JSON comparison diff
  verdict: text('verdict').notNull(),       // 'pass', 'warn', 'fail'
  reportHtml: text('report_html'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── AI Reviews (Gemini/Claude structured code review) ────────────────────────

export const aiReviews = pgTable('ai_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  developerForkId: uuid('developer_fork_id')
    .references(() => developerForks.id, { onDelete: 'cascade' }),
  sandboxRepoId: uuid('sandbox_repo_id')
    .references(() => sandboxRepos.id, { onDelete: 'cascade' }),
  prNumber: integer('pr_number'),
  verdict: text('verdict').notNull(),             // 'pass', 'needs_changes', 'high_risk'
  score: integer('score').notNull(),               // 0 to 100
  requirementMatch: text('requirement_match').notNull(),
  summary: text('summary').notNull(),
  strengths: text('strengths'),                    // JSON array string
  issues: text('issues'),                          // JSON array string
  risks: text('risks'),                            // JSON array string
  unauthorizedEdits: text('unauthorized_edits'),   // JSON array string
  resolvedIssues: text('resolved_issues'),         // JSON array string
  resolvedRisks: text('resolved_risks'),           // JSON array string
  // Layer 4 risk scoring
  riskScore: integer('risk_score'),                // 0-100 composite risk score
  riskRouting: text('risk_routing'),               // 'auto_approve', 'owner_review', 'reviewer_queue'
  model: text('model'),                            // Which AI model was used
  tokensUsed: integer('tokens_used'),              // Token usage tracking
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
