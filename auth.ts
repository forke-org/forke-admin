import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users, accounts, sessions, developers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { processLoginStreak } from '@/lib/actions/auth-actions'
import { recordAuthEvent } from '@/lib/actions/auth-events'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email/Username and password required')
        }
        
        const identifier = credentials.email as string
        
        // Find user by email or username
        let dbUser = await db.query.users.findFirst({
          where: eq(users.email, identifier)
        })

        if (!dbUser) {
          dbUser = await db.query.users.findFirst({
            where: eq(users.username, identifier)
          })
        }

        if (!dbUser || !dbUser.passwordHash) {
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          dbUser.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        return dbUser
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (!user?.email) return false

      try {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        })

        if (!dbUser) {
          const cookieStore = await cookies()
          const loginIntent = cookieStore.get('forke_login_intent')?.value
          if (loginIntent === 'true') {
            cookieStore.delete('forke_login_intent')
            console.log(`[AUTH] Blocking direct OAuth registration for non-existent user: ${user.email}`)
            return '/signin?error=AccountNotFound'
          }
        }

        if (dbUser) {
          if (dbUser.isBanned) {
            const cookieStore = await cookies()
            cookieStore.set('forke_auth_error', '1', { maxAge: 60, path: '/' })
            return '/auth-error?error=AccessDenied'
          }

          if (dbUser.deletionScheduledAt) {
            await db.update(users).set({ deletionScheduledAt: null }).where(eq(users.id, dbUser.id))
            console.log(`[AUTH] Cancelled scheduled account deletion for user: ${dbUser.id}`)
            return '/dashboard?toast=deletion_cancelled'
          }
          
          if (account?.provider === 'github' && dbUser.githubUrl && profile?.login) {
            const existingLogin = dbUser.githubUrl.split('/').pop()?.toLowerCase()
            const newLogin = (profile.login as string).toLowerCase()
            if (existingLogin && existingLogin !== newLogin) {
              console.error(`GitHub Conflict: existing (${existingLogin}) vs new (${newLogin})`)
              const cookieStore = await cookies()
              cookieStore.set('forke_auth_error', '1', { maxAge: 60, path: '/' })
              return '/auth-error?error=GitHubIdentityMismatch'
            }
          }
        }
      } catch (error: any) {
        console.error('Error in signIn db checks:', error)
      }

      try {
        if (user.id && user.id.includes('-')) {
          await processLoginStreak(user.id)
        }
      } catch (error) {
        console.error('Error processing login streak:', error)
      }
      return true
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      // Call standard edge-safe jwt callback first
      if (authConfig.callbacks?.jwt) {
        token = await authConfig.callbacks.jwt({ token, user, trigger, session })
      }

      // Capture and cache OAuth profile pictures on sign in
      if (user && token.id) {

        // First-touch marketing attribution for brand-new OAuth users.
        // Only write if the user has none yet, so re-logins never overwrite the original channel.
        if (account?.provider === 'google' || account?.provider === 'github') {
          try {
            const existing = await db.query.users.findFirst({
              where: eq(users.id, token.id as string),
              columns: { attribution: true },
            })
            const current = existing?.attribution as Record<string, any> | null
            if (!current || Object.keys(current).length === 0) {
              const { readAttributionCookie } = await import('@/lib/utils/attribution')
              const attribution = await readAttributionCookie()
              await db.update(users).set({
                attribution: {
                  source: attribution.source,
                  medium: attribution.medium,
                  campaign: attribution.campaign,
                  referrer: attribution.referrer,
                  landingPage: attribution.landingPage,
                  signupRole: 'developer',
                },
              }).where(eq(users.id, token.id as string))
            }
          } catch (e) {
            console.error('Failed to stamp OAuth attribution:', e)
          }
        }

        if (account?.provider === 'google' && user.image) {
          try {
            await db.update(users).set({ googleAvatarUrl: user.image }).where(eq(users.id, token.id as string))
          } catch (e) {
            console.error('Failed to save googleAvatarUrl on sign in:', e)
          }
        }
        if (account?.provider === 'github' && user.image) {
          try {
            await db.update(users).set({ githubAvatarUrl: user.image }).where(eq(users.id, token.id as string))
          } catch (e) {
            console.error('Failed to save githubAvatarUrl on sign in:', e)
          }
        }
      }

      // Initial Sign In: Fetch extensive GitHub Data since the user now exists in the DB
      if (account?.provider === 'github' && account.access_token && profile?.login && token.id) {
         try {
           const headers = { Authorization: `Bearer ${account.access_token}` }
           
           const userRes = await fetch(`https://api.github.com/user`, { headers })
           const githubData = userRes.ok ? await userRes.json() : null
           
           const reposRes = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated`, { headers })
           const reposData = reposRes.ok ? await reposRes.json() : null

           if (githubData && reposData) {
             const githubUrl = githubData.html_url as string || `https://github.com/${profile.login}`
             
             await db.update(users).set({ 
               githubUrl: githubUrl,
               githubAvatarUrl: githubData.avatar_url,
               githubStats: {
                 followers: githubData.followers,
                 following: githubData.following,
                 public_repos: githubData.public_repos,
                 total_private_repos: githubData.total_private_repos,
                 public_gists: githubData.public_gists,
                 private_gists: githubData.private_gists,
                 created_at: githubData.created_at,
                 updated_at: githubData.updated_at
               }
             }).where(eq(users.id, token.id as string))

             token.githubUrl = githubUrl

             const existingDev = await db.query.developers.findFirst({
               where: eq(developers.userId, token.id as string)
             })

             const languageCounts: Record<string, number> = {}
             if (Array.isArray(reposData)) {
               reposData.forEach((repo: any) => {
                 if (repo.language) {
                   languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1
                 }
               })
             }
             const languages = Object.entries(languageCounts)
               .sort((a, b) => b[1] - a[1])
               .reduce((acc, [lang, count]) => ({ ...acc, [lang]: count }), {})

             const devPayload = {
               userId: token.id as string,
               githubId: githubData.id.toString(),
               username: githubData.login,
               accessToken: account.access_token || '',
               avatarUrl: githubData.avatar_url,
               profileUrl: githubUrl,
               rawProfile: githubData,
               repos: reposData,
               languages: languages,
               isGithubConnected: true,
               updatedAt: new Date(),
             }

             if (existingDev) {
               await db.update(developers).set(devPayload).where(eq(developers.id, existingDev.id))
             } else {
               await db.insert(developers).values({
                 ...devPayload,
                 createdAt: new Date(),
               })
             }
           }
         } catch (e) {
           console.error('Error fetching extensive github stats in jwt callback:', e)
         }
      }

      // Fetch fresh data ONLY if we are not in the edge runtime (middleware)
      if (process.env.NEXT_RUNTIME !== 'edge' && token.id) {
        console.log(`[AUTH] Checking DB for user: ${token.id} (Runtime: ${process.env.NEXT_RUNTIME})`)
        try {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, token.id as string),
          })

          if (dbUser) {
            const isNewUser = dbUser.createdAt.getTime() > Date.now() - 15000;
            if (isNewUser) {
              try {
                const cookieStore = await cookies()
                const preferredRole = cookieStore.get('forke_role')?.value as 'developer' | 'owner' | undefined
                if (preferredRole && preferredRole !== dbUser.role) {
                  await db.update(users).set({ role: preferredRole }).where(eq(users.id, dbUser.id));
                  dbUser.role = preferredRole;
                }
              } catch (e) {
                console.error('Error syncing role in jwt callback:', e)
              }
            }

            token.isApproved = dbUser.isApproved
            token.isBanned = dbUser.isBanned
            token.xp = dbUser.xp
            token.level = dbUser.level
            token.currentStreak = dbUser.currentStreak
            token.githubUrl = dbUser.githubUrl
            token.username = dbUser.username
            token.role = dbUser.role

            // Fetch GitHub Connection state
            const devProfile = await db.query.developers.findFirst({
              where: eq(developers.userId, token.id as string),
            })
            token.isGithubConnected = !!devProfile?.isGithubConnected
          }
          else{
            return null
          }
        } catch (error) {
          console.error('Error fetching fresh user data in JWT:', error)
        }
      }

      return token
    },
  },
  events: {
    // Security log only (separate from marketing attribution): records a salted IP HASH
    // + coarse country on every sign-in / sign-up so we can detect abuse. Best-effort.
    async signIn({ user, account, isNewUser }) {
      await recordAuthEvent({
        userId: (user as any)?.id ?? null,
        email: user?.email ?? null,
        event: isNewUser ? 'signup' : 'signin',
        provider: account?.provider ?? 'credentials',
      })
    },
  },
})
