# Who is in Control? v2: scoring validation (final review, tied scores)

## Point patterns in the bank

| Points (sorted) | Questions |
|---|---:|
| 0, 0, 2, 3 | 31 |
| 0, 0, 1, 3 | 14 |
| 0, 0, 1, 2 | 8 |
| 0, 0, 2, 2 | 4 |
| 0, 1, 2, 3 | 1 |
| 0, 0, 3, 3 | 1 |
| 0, 0, 0, 3 | 1 |

Questions whose highest reaction is self-protective (max 2): **12 of 60**. Every question has at least one 0-point reaction.

## Formula

Ego Driving Score = 100 × (ego points of the answers given) ÷ (highest ego points available in the questions answered). Unanswered questions are excluded from both, so 10, 15 and 20 questions are on the same 0–100 scale. 100 means "the most ego-driven reaction on every question answered", not "3 points per question". The feedback levels use the bank's point scale (3), so a 2-point answer always reads as self-protective, never as ego-driven.

## Does normalising across different questions distort the score?

Same answers, three formulas, 1,000 random balanced selections per length. "Spread" = how much the score moves only because different questions were drawn (standard deviation).

### 10 questions

| Pattern | Approved: Σ points ÷ Σ question maxima | Alternative A: Σ points ÷ (3 × questions) | Alternative B: mean of (points ÷ question maximum) |
|---|---|---|---|
| Healthy confidence | mean 1, spread ±1.4 | mean 1, spread ±1.3 | mean 1, spread ±1.3 |
| Realistic mix | mean 22, spread ±11.2 | mean 20, spread ±10.5 | mean 22, spread ±11.2 |
| Defensive | mean 59, spread ±5.9 | mean 55, spread ±5.5 | mean 60, spread ±6.0 |
| Strongly ego-driven | mean 99, spread ±2.0 | mean 92, spread ±4.6 | mean 98, spread ±2.3 |

### 20 questions

| Pattern | Approved: Σ points ÷ Σ question maxima | Alternative A: Σ points ÷ (3 × questions) | Alternative B: mean of (points ÷ question maximum) |
|---|---|---|---|
| Healthy confidence | mean 1, spread ±0.8 | mean 1, spread ±0.8 | mean 1, spread ±0.8 |
| Realistic mix | mean 22, spread ±8.4 | mean 21, spread ±7.9 | mean 22, spread ±8.4 |
| Defensive | mean 59, spread ±3.6 | mean 55, spread ±3.4 | mean 60, spread ±3.8 |
| Strongly ego-driven | mean 99, spread ±1.2 | mean 92, spread ±3.0 | mean 99, spread ±1.5 |

## Category stability (approved formula)

Share of 1000 simulated players in each category, each on a fresh balanced selection.

### 10 questions

| Pattern | 🧘 0-25 | 😎 26-50 | 🦙 51-75 | 👑 76-100 | Mean score |
|---|---:|---:|---:|---:|---:|
| Strongly reflective (always the open reaction) | 100% | 0% | 0% | 0% | 0 |
| Healthy confidence (always the assertive reaction (states views, boundaries, neutral)) | 100% | 0% | 0% | 0% | 1 |
| Open or assertive (50/50) | 100% | 0% | 0% | 0% | 0 |
| Realistic mix (35% open, 35% assertive, 20% self-protective, 10% ego-driven) | 63% | 36% | 1% | 0% | 22 |
| Defensive (always the self-protective reaction) | 0% | 10% | 90% | 0% | 59 |
| Strongly ego-driven (always the ego-driven reaction) | 0% | 0% | 0% | 100% | 99 |
| Uniform random (any reaction, equally likely) | 16% | 63% | 21% | 1% | 40 |

### 15 questions

| Pattern | 🧘 0-25 | 😎 26-50 | 🦙 51-75 | 👑 76-100 | Mean score |
|---|---:|---:|---:|---:|---:|
| Strongly reflective (always the open reaction) | 100% | 0% | 0% | 0% | 0 |
| Healthy confidence (always the assertive reaction (states views, boundaries, neutral)) | 100% | 0% | 0% | 0% | 1 |
| Open or assertive (50/50) | 100% | 0% | 0% | 0% | 0 |
| Realistic mix (35% open, 35% assertive, 20% self-protective, 10% ego-driven) | 67% | 33% | 0% | 0% | 22 |
| Defensive (always the self-protective reaction) | 0% | 4% | 97% | 0% | 59 |
| Strongly ego-driven (always the ego-driven reaction) | 0% | 0% | 0% | 100% | 99 |
| Uniform random (any reaction, equally likely) | 10% | 74% | 17% | 0% | 40 |

### 20 questions

| Pattern | 🧘 0-25 | 😎 26-50 | 🦙 51-75 | 👑 76-100 | Mean score |
|---|---:|---:|---:|---:|---:|
| Strongly reflective (always the open reaction) | 100% | 0% | 0% | 0% | 0 |
| Healthy confidence (always the assertive reaction (states views, boundaries, neutral)) | 100% | 0% | 0% | 0% | 1 |
| Open or assertive (50/50) | 100% | 0% | 0% | 0% | 0 |
| Realistic mix (35% open, 35% assertive, 20% self-protective, 10% ego-driven) | 70% | 30% | 0% | 0% | 22 |
| Defensive (always the self-protective reaction) | 0% | 1% | 99% | 0% | 59 |
| Strongly ego-driven (always the ego-driven reaction) | 0% | 0% | 0% | 100% | 99 |
| Uniform random (any reaction, equally likely) | 8% | 79% | 13% | 0% | 40 |

## Feedback coherence

"Incoherent" counts feedback that contradicts the answers and must be 0. It counts five cases:
- a reflection without any self-protective or ego-driven answer
- a single situation without an ego-driven answer
- a pattern based on fewer than 2 answers
- a strength contradicted by a self-protective or ego-driven answer
- the same area named as a strength and as the reflection

"Hits target" is the share of reflections naming an area the pattern was built to stress.

### 10 questions

| Pattern | Most common category | ≥ 1 strength | Pattern found | Single situation | Nothing to reflect on | Hits target | Incoherent |
|---|---|---:|---:|---:|---:|---:|---:|
| Strongly reflective | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Healthy confidence | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Open or assertive | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Realistic mix | 🧘 67% | 98% | 18% | 43% | 39% | – | 0 |
| Defensive | 🦙 90% | 1% | 89% | 3% | 8% | – | 0 |
| Strongly ego-driven | 👑 100% | 0% | 100% | 0% | 0% | – | 0 |
| Uniform random | 😎 65% | 83% | 54% | 38% | 8% | – | 0 |
| Ego in recognition only | 🧘 100% | 100% | 67% | 24% | 10% | 90% | 0 |
| Defensive in feedback + collaboration | 🧘 90% | 100% | 42% | 0% | 58% | 42% | 0 |
| Assertive, ego in humility | 🧘 100% | 100% | 67% | 25% | 7% | 93% | 0 |

### 15 questions

| Pattern | Most common category | ≥ 1 strength | Pattern found | Single situation | Nothing to reflect on | Hits target | Incoherent |
|---|---|---:|---:|---:|---:|---:|---:|
| Strongly reflective | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Healthy confidence | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Open or assertive | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Realistic mix | 🧘 69% | 99% | 42% | 37% | 21% | – | 0 |
| Defensive | 🦙 97% | 1% | 100% | 0% | 0% | – | 0 |
| Strongly ego-driven | 👑 100% | 0% | 100% | 0% | 0% | – | 0 |
| Uniform random | 😎 77% | 87% | 86% | 13% | 2% | – | 0 |
| Ego in recognition only | 🧘 100% | 100% | 100% | 0% | 0% | 100% | 0 |
| Defensive in feedback + collaboration | 🧘 96% | 100% | 78% | 0% | 22% | 78% | 0 |
| Assertive, ego in humility | 🧘 100% | 100% | 100% | 0% | 0% | 100% | 0 |

### 20 questions

| Pattern | Most common category | ≥ 1 strength | Pattern found | Single situation | Nothing to reflect on | Hits target | Incoherent |
|---|---|---:|---:|---:|---:|---:|---:|
| Strongly reflective | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Healthy confidence | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Open or assertive | 🧘 100% | 100% | 0% | 0% | 100% | – | 0 |
| Realistic mix | 🧘 69% | 98% | 50% | 38% | 12% | – | 0 |
| Defensive | 🦙 98% | 0% | 100% | 0% | 0% | – | 0 |
| Strongly ego-driven | 👑 100% | 0% | 100% | 0% | 0% | – | 0 |
| Uniform random | 😎 77% | 68% | 89% | 11% | 0% | – | 0 |
| Ego in recognition only | 🧘 100% | 100% | 100% | 0% | 0% | 100% | 0 |
| Defensive in feedback + collaboration | 🧘 99% | 100% | 84% | 0% | 16% | 84% | 0 |
| Assertive, ego in humility | 🧘 100% | 100% | 100% | 0% | 0% | 100% | 0 |

