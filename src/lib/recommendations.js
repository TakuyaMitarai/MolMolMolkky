// Skittle recommendation — ports DataManager.getRecommendations.
// Enumerate combinations of 1..maxMoves throws (each 1..12) that reach 50.

export function getRecommendations(currentScore, maxMoves = 3) {
  const targetScore = 50
  const remaining = targetScore - currentScore
  let combinations = []

  // 1 move
  if (remaining >= 1 && remaining <= 12) {
    combinations.push([remaining])
  }
  // 2 moves
  if (maxMoves >= 2) {
    for (let first = 1; first <= 12; first++) {
      const second = remaining - first
      if (second >= 1 && second <= 12) combinations.push([first, second])
    }
  }
  // 3 moves
  if (maxMoves >= 3) {
    for (let first = 1; first <= 12; first++) {
      for (let second = 1; second <= 12; second++) {
        const third = remaining - first - second
        if (third >= 1 && third <= 12) combinations.push([first, second, third])
      }
    }
  }

  // dedupe by sorted-combination, then sort by move count ascending
  const seen = new Set()
  const unique = []
  for (const combo of combinations) {
    const sorted = [...combo].sort((a, b) => a - b)
    const key = sorted.join(',')
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(sorted)
    }
  }
  unique.sort((a, b) => a.length - b.length)

  return { combinations: unique, targetScore, maxMoves }
}
