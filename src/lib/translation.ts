// Translation utility using OpenAI API
// Translates messages to user's preferred language

interface TranslationOptions {
  targetLang?: string
  sourceLang?: string
}

/**
 * Translate a message to the target language using OpenAI
 * Falls back to original text if translation fails or language is 'en'
 */
export async function translateMessage(
  text: string,
  targetLang: string = 'en',
  _options: TranslationOptions = {}
): Promise<string> {
  // No translation needed for English or if no target language
  if (!targetLang || targetLang === 'en' || !text?.trim()) {
    return text
  }

  // Translation must run through a server/Edge Function. A VITE_ OpenAI key
  // would be exposed to every browser, so fail closed until that endpoint is
  // wired.
  return text
}

/**
 * Get language name from code
 */
function _getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'ar': 'Arabic',
    'fr': 'French',
    'fil': 'Filipino',
    'pt': 'Portuguese',
    'de': 'German',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'hi': 'Hindi',
    'ru': 'Russian',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
  }
  return languages[code] || code
}

/**
 * Batch translate multiple messages
 * Useful for chat messages
 */
export async function translateMessages(
  messages: string[],
  targetLang: string = 'en'
): Promise<string[]> {
  if (!targetLang || targetLang === 'en') {
    return messages
  }

  // Translate in parallel (with rate limiting consideration)
  const translations = await Promise.all(
    messages.map(msg => translateMessage(msg, targetLang))
  )

  return translations
}
