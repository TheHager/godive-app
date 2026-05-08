import leoProfanity from 'leo-profanity';

// Initialize with default English dictionary
leoProfanity.loadDictionary('en');

/**
 * Filters profanity from a string by replacing it with asterisks
 */
export const filterProfanity = (text: string): string => {
  if (!text) return text;
  return leoProfanity.clean(text);
};

/**
 * Checks if a string contains profanity
 */
export const hasProfanity = (text: string): boolean => {
  if (!text) return false;
  return leoProfanity.check(text);
};
