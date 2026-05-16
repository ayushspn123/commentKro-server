const { v4: uuidv4 } = require('uuid');

/**
 * Generates a unique trace ID for request correlation.
 */
const generateTraceId = () => uuidv4();

/**
 * Interpolates template variables in a message template.
 * e.g. "Hello {{name}}!" with { name: "Alice" } → "Hello Alice!"
 * @param {string} template
 * @param {Record<string, string>} variables
 */
const interpolateTemplate = (template, variables = {}) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
};

/**
 * Safely parses a JSON string; returns null on failure.
 */
const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

/**
 * Checks if a comment text matches automation keywords.
 * @param {string} text - Comment text
 * @param {string[]} keywords
 * @param {'any'|'all'|'exact'} matchType
 * @param {boolean} caseSensitive
 */
const matchesKeywords = (text, keywords, matchType = 'any', caseSensitive = false) => {
  const normalize = (s) => (caseSensitive ? s : s.toLowerCase());
  const normalizedText = normalize(text);
  const normalizedKeywords = keywords.map(normalize);

  switch (matchType) {
    case 'any':
      return normalizedKeywords.some((kw) => normalizedText.includes(kw));
    case 'all':
      return normalizedKeywords.every((kw) => normalizedText.includes(kw));
    case 'exact':
      return normalizedKeywords.some((kw) => normalizedText === kw);
    default:
      return false;
  }
};

/**
 * Adds a delay (for rate limiting / backoff purposes).
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { generateTraceId, interpolateTemplate, safeJsonParse, matchesKeywords, sleep };
