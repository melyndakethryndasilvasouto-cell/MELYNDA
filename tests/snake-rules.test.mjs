import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceSnake, chooseFreeCell } from '../src/games/Snake/snakeRules.mjs'

test('direção inválida não derruba o loop da cobrinha', () => {
  const next = advanceSnake([{ x: 1, y: 1 }], 'INVALID', null, null, 4)
  assert.equal(next.collision, true)
  assert.equal(next.points, 0)
})

test('Cobrinha pode entrar na casa da cauda quando ela sai no mesmo movimento', () => {
  const snake = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }]
  const next = advanceSnake(snake, 'LEFT', { x: 3, y: 3 }, null, 4)
  assert.equal(next.collision, false)
  assert.equal(next.snake.length, snake.length)
  assert.deepEqual(next.snake[0], { x: 0, y: 1 })
  assert.equal(new Set(next.snake.map(p => `${p.x},${p.y}`)).size, 4)
})

test('Cobrinha continua bloqueando corpo e paredes', () => {
  const snake = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }]
  assert.equal(advanceSnake(snake, 'DOWN', null, null, 4).collision, true)
  assert.equal(advanceSnake([{ x: 0, y: 0 }], 'LEFT', null, null, 4).collision, true)
  assert.deepEqual(snake[0], { x: 1, y: 1 })
})

test('Comida nova exclui a cabeça recém-ocupada e retorna null no tabuleiro cheio', () => {
  const next = advanceSnake([{ x: 0, y: 0 }], 'RIGHT', { x: 1, y: 0 }, null, 2)
  assert.equal(next.points, 1)
  assert.equal(next.snake.length, 2)
  for (const value of [0, 0.5, 0.999999]) {
    const food = chooseFreeCell(next.snake, 2, () => value)
    assert.equal(food.y, 1)
  }
  const full = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
  assert.equal(chooseFreeCell(full, 2, () => { throw Error('não deve sortear') }), null)
})

test('Última comida encerra em vitória sem precisar sortear outra posição', () => {
  const snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
  const next = advanceSnake(snake, 'RIGHT', { x: 1, y: 0 }, null, 2)
  assert.equal(next.won, true)
  assert.equal(next.collision, false)
  assert.equal(next.snake.length, 4)
  assert.equal(next.points, 1)
})

test('Comida especial cresce uma casa e concede cinco pontos', () => {
  const next = advanceSnake([{ x: 0, y: 0 }], 'RIGHT', { x: 1, y: 1 }, { x: 1, y: 0 }, 3)
  assert.equal(next.ateSpecial, true)
  assert.equal(next.ateFood, false)
  assert.equal(next.points, 5)
  assert.equal(next.snake.length, 2)
})
