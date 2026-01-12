import '@dotenvx/dotenvx/config';
import { db } from '@push-platform/db';
import { applications, tenants } from '@push-platform/db';
import { eq } from 'drizzle-orm';

async function seedData() {
  console.log('Seeding database...');

  try {
    // Create sample application
    const existingApp = await db.query.applications.findFirst({
      where: eq(applications.slug, 'myapp'),
    });

    let appId: string;

    if (existingApp) {
      console.log('Application "myapp" already exists');
      appId = existingApp.id;
    } else {
      const [app] = await db
        .insert(applications)
        .values({
          slug: 'myapp',
          name: 'My App',
          firebaseConfig: null, // In dev mode, will use FIREBASE_PROJECT_ID env var
        })
        .returning();

      appId = app.id;
      console.log(`Created application: ${app.id} (${app.slug})`);
    }

    // Create sample tenant
    const existingTenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, 'tenant1'),
    });

    if (existingTenant) {
      console.log('Tenant "tenant1" already exists');
      console.log(`Tenant ID: ${existingTenant.id}`);
    } else {
      const [tenant] = await db
        .insert(tenants)
        .values({
          applicationId: appId,
          slug: 'tenant1',
          name: 'Tenant One',
          metadata: {
            description: 'Sample tenant for testing',
          },
        })
        .returning();

      console.log(`Created tenant: ${tenant.id} (${tenant.slug})`);
    }

    console.log('\nSeed data complete!');
    console.log(`\nApplication ID: ${appId}`);
    console.log('Application Slug: myapp');
    console.log('\nYou can now generate onboarding tokens using:');
    console.log('npm run generate-token -- --appSlug myapp --tenantSlug tenant1');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
