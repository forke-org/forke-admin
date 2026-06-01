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

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').default('developer').notNull(),
  level: integer('level').default(1).notNull(),
  xp: integer('xp').default(0).notNull(),
  githubUrl: text('github_url'),
  bio: text('bio'),
  githubStats: jsonb('github_stats'),
  lastLoginAt: timestamp('last_login_at'),
  currentStreak: integer('current_streak').default(0).notNull(),
  isApproved: boolean('is_approved').default(false).notNull(),
  isBanned: boolean('is_banned').default(false).notNull(),
  emailAlerts: boolean('email_alerts').default(true),
  slackWebhooks: boolean('slack_webhooks').default(false),
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

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compoundKey: {
      columns: [vt.identifier, vt.token],
      primaryKey: true,
    },
  })
)

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

export const githubProfiles = pgTable('github_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  githubId: text('github_id').notNull(),
  login: text('login').notNull(),
  avatarUrl: text('avatar_url'),
  profileUrl: text('profile_url'),
  repos: jsonb('repos'),
  languages: jsonb('languages'),
  rawProfile: jsonb('raw_profile'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  githubId: integer('github_id').notNull().unique(),
  username: text('username').notNull(),
  accessToken: text('access_token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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



