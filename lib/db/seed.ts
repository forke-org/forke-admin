import * as dotenv from 'dotenv'

// Load environment variables first
dotenv.config({ path: '.env.local' })

async function main() {
  // 1. Safety check: Never run in production
  if (process.env.NODE_ENV === 'production') {
    console.error('🚫 Error: Cannot run seed script in production environment.')
    process.exit(1)
  }

  console.log('🌱 Starting database seeding...')

  try {
    // Dynamically import database and schema after env variables are loaded
    const { db } = await import('./index')
    const { admins } = await import('./schema')
    const bcrypt = await import('bcryptjs')

    const defaultUsername = 'admin'
    const defaultPassword = 'admin123' // Dev password
    const passwordHash = await bcrypt.default.hash(defaultPassword, 10)

    console.log(`Creating default admin user: "${defaultUsername}"`)

    // 2. Insert or update the default admin
    await db
      .insert(admins)
      .values({
        name: 'Demo Admin',
        email: 'admin@forke.space',
        username: defaultUsername,
        passwordHash: passwordHash,
        role: 'super_admin',
      })
      .onConflictDoUpdate({
        target: admins.username,
        set: { passwordHash: passwordHash },
      })

    console.log('✅ Seeding completed successfully!')
    console.log('--------------------------------------------------')
    console.log(`Default Local Admin Credentials:`)
    console.log(`Username: ${defaultUsername}`)
    console.log(`Password: ${defaultPassword}`)
    console.log('--------------------------------------------------')
    process.exit(0)
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

main()
