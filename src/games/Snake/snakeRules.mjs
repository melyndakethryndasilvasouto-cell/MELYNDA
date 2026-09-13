/** Select from free cells directly: a full board must never spin forever. */
export function chooseFreeCell(exclude, grid = 20, random = Math.random) {
  const occupied = new Set(exclude.map(({ x, y }) => `${x},${y}`))
  const available = []
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      if (!occupied.has(`${x},${y}`)) available.push({ x, y })
    }
  }
  if (!available.length) return null
  const value = Number(random())
  const fraction = Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0
  return available[Math.floor(fraction * available.length)]
}

export function advanceSnake(snake, direction, food, special, grid = 20) {
  const vectors = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] }
  // Inputs can come from keyboard/touch handlers and must never be trusted.
  // Treat an unknown direction as an immediate invalid move instead of
  // destructuring undefined and crashing the game loop.
  const vector = vectors[direction]
  if (!vector || !Array.isArray(snake) || !snake[0]) {
    return { collision: true, snake, ateFood: false, ateSpecial: false, points: 0, won: false }
  }
  const [dx, dy] = vector
  const head = { x: snake[0].x + dx, y: snake[0].y + dy }
  const matches = point => point && point.x === head.x && point.y === head.y
  const ateFood = Boolean(matches(food))
  const ateSpecial = Boolean(matches(special))
  const grows = ateFood || ateSpecial
  // The tail leaves its cell during a non-growing move.
  const body = grows ? snake : snake.slice(0, -1)
  const collision = head.x < 0 || head.y < 0 || head.x >= grid || head.y >= grid || body.some(matches)
  return {
    collision,
    snake: collision ? snake : [head, ...body],
    ateFood,
    ateSpecial,
    points: collision ? 0 : Number(ateFood) + Number(ateSpecial) * 5,
    won: !collision && body.length + 1 === grid * grid,
  }
}
