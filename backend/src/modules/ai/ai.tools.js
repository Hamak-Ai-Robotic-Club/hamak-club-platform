// Read-only inventory tools for the assistant. Results always come from the
// database at query time (spec §08): the assistant never writes inventory.
const { listCatalog } = require("../../routes/components");
const { metaFor } = require("../catalog/catalogMeta");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ");
}

const stopWords = new Set([
  "انا", "نريد", "اريد", "بدي", "مع", "لي", "لنا", "هو", "هي", "ذلك", "هذا", "مشروع", "فكره", "عن", "في", "من", "على", "الى", "او", "و",
  "ما", "هل", "كيف", "the", "a", "an", "and", "or", "for", "to", "of", "with", "i", "we",
  "want", "need", "project", "idea", "make", "build", "يعمل", "قطع", "القطع", "متوفره", "المتوفره",
]);

function tokenize(text) {
  // Arabic words often carry attached prefixes (و / ب / ل / ال): keep the word
  // and its stripped variant so "والحرارة" still matches "حرارة".
  return normalize(text)
    .split(/\s+/)
    .flatMap((word) => {
      const base = word.replace(/^ال/, "");
      const stripped = word.replace(/^(و|ف|ب|ل|ك)?(ال|لل)/, "").replace(/^(و|ب|ل)(?=\p{L}{3,})/u, "");
      return [...new Set([base, stripped])];
    })
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function haystack(item) {
  const meta = metaFor(item.name);
  return normalize(
    `${item.name} ${meta?.en || ""} ${meta?.tags || ""} ${item.category} ${item.description || ""}`,
  );
}

async function searchAvailableComponents(prisma, { keywords = [], limit = 8 } = {}) {
  const { items } = await listCatalog(prisma);
  const tokens = [...new Set(keywords.flatMap((keyword) => tokenize(keyword)))];
  const scored = items
    .map((item) => {
      const text = haystack(item);
      const score = tokens.reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
      return { item, score };
    })
    .filter(({ score }) => (tokens.length ? score > 0 : true))
    .sort((a, b) => b.score - a.score || b.item.availableQuantity - a.item.availableQuantity)
    .slice(0, Math.min(Math.max(limit, 1), 20));

  return scored.map(({ item }) => ({
    componentId: item.id,
    name: item.name,
    nameEn: item.nameEn,
    category: item.category,
    availableQuantity: item.availableQuantity,
    imageUrl: item.imageUrl,
  }));
}

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_available_components",
      description:
        "Search the club inventory (read-only) and return matching components with their CURRENT available quantity. Use English and Arabic keywords describing capabilities (e.g. temperature, distance, wifi, motor, حرارة, مسافة).",
      parameters: {
        type: "object",
        properties: {
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Capabilities or component names to search for.",
          },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["keywords"],
      },
    },
  },
];

module.exports = { searchAvailableComponents, toolDefinitions, tokenize };
