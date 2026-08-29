// Keeps every mode's computation instant in the browser: a full sieve up to
// this bound runs in milliseconds, and trial division against candidates
// below it (see `isPrime`) never gets slow enough to notice.
export const MAX_RANGE_END = 1_000_000
export const MAX_FROM_START = 1_000_000
export const MAX_FROM_COUNT = 1_000

function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n % 2 === 0) return n === 2
  for (let divisor = 3; divisor * divisor <= n; divisor += 2) {
    if (n % divisor === 0) return false
  }
  return true
}

/** Every prime in `[start, end]`, via a sieve of Eratosthenes up to `end`. */
export function primesInRange(start: number, end: number): number[] {
  if (end < 2) return []
  const composite = new Uint8Array(end + 1)
  for (let i = 2; i * i <= end; i++) {
    if (composite[i]) continue
    for (let multiple = i * i; multiple <= end; multiple += i) {
      composite[multiple] = 1
    }
  }
  const primes: number[] = []
  for (let i = Math.max(2, Math.ceil(start)); i <= end; i++) {
    if (!composite[i]) primes.push(i)
  }
  return primes
}

/** The next `count` primes at or after `start`, via trial division per candidate. */
export function nextPrimesFrom(start: number, count: number): number[] {
  const primes: number[] = []
  let candidate = Math.max(2, Math.ceil(start))
  while (primes.length < count) {
    if (isPrime(candidate)) primes.push(candidate)
    candidate++
  }
  return primes
}
