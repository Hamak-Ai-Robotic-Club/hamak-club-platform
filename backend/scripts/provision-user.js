const prisma = require("../src/config/prisma");
const { hashPassword } = require("../src/utils/password");

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set to create an account.`);
  return value;
}

async function main() {
  const username = requiredEnvironment("AUTH_USERNAME").trim().toLowerCase();
  const password = requiredEnvironment("AUTH_PASSWORD");
  const accountType = requiredEnvironment("AUTH_ACCOUNT_TYPE").trim().toUpperCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new Error("AUTH_USERNAME must be 3-64 lowercase letters, digits, or ._- characters.");
  }
  if (password.length < 12 || password.length > 1024) {
    throw new Error("AUTH_PASSWORD must be between 12 and 1024 characters.");
  }
  if (!["ADMIN", "TEAM"].includes(accountType)) {
    throw new Error("AUTH_ACCOUNT_TYPE must be ADMIN or TEAM.");
  }

  const passwordHash = await hashPassword(password);
  const account = await prisma.$transaction(async (transaction) => {
    let teamId = null;
    if (accountType === "TEAM") {
      const teamName = requiredEnvironment("AUTH_TEAM_NAME").trim();
      if (teamName.length < 2 || teamName.length > 80) {
        throw new Error("AUTH_TEAM_NAME must be between 2 and 80 characters.");
      }
      let team = await transaction.team.findFirst({
        where: { name: { equals: teamName, mode: "insensitive" } },
      });
      if (!team) team = await transaction.team.create({ data: { name: teamName } });
      if (!team.isActive) throw new Error("The requested team is inactive.");
      teamId = team.id;
    }

    return transaction.user.create({
      data: {
        username,
        passwordHash,
        accountType,
        teamId,
        displayName: username,
      },
      select: { id: true, username: true, accountType: true, teamId: true },
    });
  });

  console.info(
    `Created ${account.accountType} account "${account.username}" with id ${account.id}.`,
  );
}

main()
  .catch((error) => {
    console.error("Could not create account:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
