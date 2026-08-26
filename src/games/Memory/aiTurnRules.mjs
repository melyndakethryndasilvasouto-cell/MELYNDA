export function shouldContinueAiTurn({ mode, currentPlayer, matchedPairs, totalPairs }) {
  return mode === 'ai' && currentPlayer === 2 && matchedPairs < totalPairs
}
