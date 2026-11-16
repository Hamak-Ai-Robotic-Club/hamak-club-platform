const [major, minor] = process.versions.node.split(".").map(Number);

const isSupported =
  (major === 20 && minor >= 19) ||
  (major === 22 && minor >= 12) ||
  major === 24;

if (!isSupported) {
  console.error(
    `Prisma 7.10.1 requires Node.js 20.19+, 22.12+, or 24.x; found ${process.versions.node}. ` +
      "Select a supported project runtime before running Prisma commands. No system settings were changed.",
  );
  process.exitCode = 1;
}
