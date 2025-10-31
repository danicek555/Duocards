/**
 * Script to delete all users from the database
 *
 * This is useful when passwords are stored in an incompatible format
 * and you need to start fresh with properly hashed passwords.
 */

import { prisma } from "../src/lib/prisma";

async function deleteAllUsers() {
  try {
    console.log("Deleting all users from the database...");

    // Delete all users (related words will be cascade deleted)
    const result = await prisma.user.deleteMany({});

    console.log(`Successfully deleted ${result.count} user(s).`);
    console.log(
      "You can now register new users with properly hashed passwords."
    );
  } catch (error) {
    console.error("Error deleting users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllUsers();
