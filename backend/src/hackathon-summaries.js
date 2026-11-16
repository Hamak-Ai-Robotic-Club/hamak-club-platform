async function saveHackathonSummary(prisma, summary) {
  if (
    summary.summaryData === null ||
    typeof summary.summaryData !== "object" ||
    Array.isArray(summary.summaryData)
  ) {
    throw new TypeError("summaryData must be a JSON object.");
  }

  if (summary.title !== undefined && typeof summary.title !== "string") {
    throw new TypeError("title must be a string when provided.");
  }

  return prisma.hackathonSummary.create({
    data: {
      createdByUserId: summary.createdByUserId ?? null,
      title: summary.title,
      summaryData: summary.summaryData,
    },
  });
}

module.exports = { saveHackathonSummary };
