import 'dotenv/config';
import prisma from '../src/lib/prisma';

/**
 * Script to generate wallets for all existing users who don't have one
 * Run with: npx ts-node scripts/generate-wallets.ts
 */

async function generateWalletsForExistingUsers() {
  try {
    console.log('🔍 Finding users without wallets...');
    
    // Get all users who don't have a wallet
    const usersWithoutWallets = await prisma.user.findMany({
      where: {
        wallet: null,
        is_deleted: false,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
      },
    });

    console.log(`📊 Found ${usersWithoutWallets.length} users without wallets`);

    if (usersWithoutWallets.length === 0) {
      console.log('✅ All users already have wallets!');
      return;
    }

    // Create wallets for each user
    let created = 0;
    let failed = 0;

    for (const user of usersWithoutWallets) {
      try {
        await prisma.wallet.create({
          data: {
            user_id: user.id,
            available_balance: 0,
            frozen_balance: 0,
            currency: 'NGN',
          },
        });
        
        created++;
        console.log(`✅ Created wallet for user: ${user.email} (${user.full_name || 'No name'})`);
      } catch (error) {
        failed++;
        console.error(`❌ Failed to create wallet for user: ${user.email}`, error);
      }
    }

    console.log('\n🎉 Summary:');
    console.log(`✅ Successfully created: ${created} wallets`);
    console.log(`❌ Failed: ${failed} wallets`);
    console.log(`📊 Total processed: ${usersWithoutWallets.length} users`);
    
  } catch (error) {
    console.error('❌ Error generating wallets:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateWalletsForExistingUsers();
