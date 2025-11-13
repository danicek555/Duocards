/**
 * Script to check users in the database and their password hash formats
 *
 * This helps diagnose password authentication issues
 */

import { prisma } from "../src/lib/prisma";

async function checkUsers() {
  try {
    console.log("Checking users in the database...\n");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
        password: true, // We need to see the hash format
      },
    });

    if (users.length === 0) {
      console.log("No users found in the database.");
      console.log("You can register a new user through the registration API.");
      return;
    }

    console.log(`Found ${users.length} user(s):\n`);

    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Nickname: ${user.nickname}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log(
        `  Password hash prefix: ${user.password.substring(0, 30)}...`
      );
      console.log(`  Password hash length: ${user.password.length}`);
      console.log(`  Is Argon2 hash: ${user.password.startsWith("$argon2")}`);

      if (!user.password.startsWith("$argon2")) {
        console.log(`  ⚠️  WARNING: Password is NOT in Argon2 format!`);
        console.log(
          `     This user cannot login. The password needs to be reset.`
        );
      }
      console.log("");
    });

    console.log("\nTo fix users with invalid password hashes:");
    console.log("1. Delete the user (or use delete-users.ts script)");
    console.log("2. Register a new user with the same email");
    console.log("3. Or manually update the password hash using Prisma Studio");
  } catch (error) {
    console.error("Error checking users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
