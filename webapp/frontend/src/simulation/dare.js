/**
 * Generic n×n matrix operations and Discrete-time Algebraic Riccati Equation solver.
 * Matrices are row-major arrays of arrays: [[r0c0, r0c1], [r1c0, r1c1]]
 */

export function zeros(n, m = n) {
  return Array.from({ length: n }, () => new Array(m).fill(0))
}

export function eye(n) {
  const I = zeros(n)
  for (let i = 0; i < n; i++) I[i][i] = 1
  return I
}

export function transpose(A) {
  const n = A.length, m = A[0].length
  const At = zeros(m, n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      At[j][i] = A[i][j]
  return At
}

export function matmul(A, B) {
  const n = A.length, k = A[0].length, m = B[0].length
  const C = zeros(n, m)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j]
  return C
}

export function matadd(A, B) {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]))
}

export function matsub(A, B) {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]))
}

/** Gauss-Jordan inverse — works for n ≤ 5 (all our use cases) */
export function matinv(A) {
  const n = A.length
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row
    ;[M[col], M[pivotRow]] = [M[pivotRow], M[col]]

    const pivot = M[col][col]
    if (Math.abs(pivot) < 1e-14) continue
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pivot

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = M[row][col]
      for (let j = 0; j < 2 * n; j++) M[row][j] -= f * M[col][j]
    }
  }
  return M.map(row => row.slice(n))
}

/**
 * Solve the DARE via value iteration:
 *   P = Q + A'PA − A'PB (R + B'PB)⁻¹ B'PA
 *
 * A: n×n, B: n×m, Q: n×n symmetric, R: m×m symmetric positive-definite
 * Returns P: n×n
 */
export function solveDARE(A, B, Q, R, maxIter = 800, tol = 1e-10) {
  let P = Q.map(row => [...row])
  const At = transpose(A)
  const Bt = transpose(B)

  for (let iter = 0; iter < maxIter; iter++) {
    const BtP   = matmul(Bt, P)
    const S     = matadd(R, matmul(BtP, B))       // m×m
    const Sinv  = matinv(S)
    const AtP   = matmul(At, P)
    const AtPB  = matmul(AtP, B)                   // n×m
    const BtPA  = matmul(Bt, matmul(P, A))         // m×n
    const G     = matmul(matmul(AtPB, Sinv), BtPA) // n×n

    const Pnew = matsub(matadd(Q, matmul(At, matmul(P, A))), G)

    let diff = 0
    for (let i = 0; i < n(Pnew); i++)
      for (let j = 0; j < Pnew[0].length; j++)
        diff += Math.abs(Pnew[i][j] - P[i][j])
    P = Pnew
    if (diff < tol) break
  }
  return P
}

function n(M) { return M.length }

/**
 * Compute optimal feedback gain:
 *   K = (R + B'PB)⁻¹ B'PA   →  m×n
 */
export function computeK(A, B, P, R) {
  const Bt   = transpose(B)
  const S    = matadd(R, matmul(Bt, matmul(P, B)))
  const Sinv = matinv(S)
  return matmul(Sinv, matmul(Bt, matmul(P, A)))
}
