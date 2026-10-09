import { InternetGameEngine, InternetGameState, InternetGameType } from './InternetGameTypes';

export type ExtendedGameType = InternetGameType | 'reaction-speed' | 'two-truths-lie' | 'fame-shame-wheel' | 'troll-identity-hunt' | 'multiplayer-solitaire' | 'multiplayer-dominoes';

export function getInternetGameEngine(gameType: ExtendedGameType): InternetGameEngine<InternetGameState> {
  // Normalize game type to handle any casing issues
  const normalizedType = gameType?.toLowerCase?.() || gameType;

  switch (normalizedType) {
    default:
      console.error(`[InternetGameEngineFactory] Unsupported game type: '${gameType}' (normalized: '${normalizedType}')`);
      throw new Error(`Game type '${gameType}' is not an internet game. Use the legacy MatchController for this game.`);
  }
}

export function isInternetGame(gameType: string): gameType is InternetGameType {
  return false;
}

export function getAllInternetGames() {
  return [];
}