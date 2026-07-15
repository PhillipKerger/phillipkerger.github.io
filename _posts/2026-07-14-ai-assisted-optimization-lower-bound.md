---
layout: post
title: "An AI-Assisted Breakthrough in Convex Optimization"
date: 2026-07-14
---

I am baffled enough to post about a problem I solved "together" with OpenAI's most recent 5.6 Sol model. I am not an AI hype person, but this feels like a massive step toward producing real research results.

In a single 2.5-hour session, using a long prompt modeled on the approach OpenAI recently used for the cycle double cover conjecture, Sol 5.6 produced a proof of a result in mathematical optimization that had been open since 1996. The proof was then formally verified in Lean, alongside my own review.

The result concerns how much information is required to solve a class of optimization problems. It tells us that certain methods used for these problems are close to optimal. I had thought about this question on and off for the past year and had several possible approaches that I could never quite complete. I had followed AI's mathematical progress from a distance, but seeing it happen on a problem I had spent time with was genuinely startling.

The paper and Lean verification are available on [GitHub](https://www.linkedin.com/safety/go/?url=https%3A%2F%2Flnkd%2Ein%2FgpXXqYk2&urlhash=Ervm&mt=87VUWC5HIv9LlIMEb3PUtx50gGsEMcTKKy22Yonaa0B8iBbofCJDUId0Ii_pfYLA0V_PGbR2lRtBGvbz3rRnsvDqrVPx9-0mpoc-FaJTC1NA0m--5bnzaivoMg&isSdui=true).

For readers interested in the technical statement, the proof establishes a new lower bound on the oracle complexity of deterministic, possibly nonsmooth, zeroth-order convex optimization as a function of the dimension $d$. Put simply, it answers the question: how many function evaluations are needed to solve a convex optimization problem?

An algorithm due to Protasov (1996) uses on the order of $d^2$ function evaluations, showing that $O(d^2)$ evaluations suffice. Until now, the best lower bound was only on the order of $d$, leaving a factor-$d$ gap for roughly three decades. The new result gives a lower bound of $	ilde{\Omega}(d^2)$ in this setting, up to logarithmic and constant factors, essentially closing that gap.

I have included the full 10-page prompt that led to the initial proof in the [preprint](https://www.linkedin.com/safety/go/?url=https%3A%2F%2Flnkd%2Ein%2FgYbTa8Ek&urlhash=jtlU&mt=sy647ztk7D9cwJbS3h88vDnM0x4OYfAS8mRv5IYnvPm5PCcAkVaH9q4xcEc7LUPfuKt6M4Sk4h0WCFMxbOPOka99WnPhEkUN9Tr9nVhD89dynRbEFVBq8JhdIg&isSdui=true), which is also going on arXiv tomorrow, and have shared the [initial chat](https://www.linkedin.com/safety/go/?url=https%3A%2F%2Flnkd%2Ein%2Fgv_Mv--u&urlhash=9Udh&mt=w9jAqorNz7ugGHWZq4oLAVBZWWZCwHYlbXM3slbPEDSzn904GUifvCDRa7Dxh3Eslx7Sl4VcvjiapQqpbDDsbBN3GpOZU2uueIfIzn5rdOTCs_343KqcafVT5g&isSdui=true).

It is worth emphasizing that I had previously put this problem to GPT 5.4 and 5.5, with several rounds of iteration, without success. Sol 5.6 Ultra, combined with the right prompting, solved it in one session. The prompt drew on OpenAI's prompt for the possible proof of the cycle double cover conjecture. That result remains a preprint and has not been formally verified in Lean, but the structure of the prompt seems to be a powerful formula.

Are there hundreds of problems that researchers are working on that are now one prompt away from being solved? Unless I have been exceptionally lucky, the answer may be yes.

<div style="font-size: 0.9em;">

A few additional comments:

1. We need to be careful with AI-assisted mathematics. There was already an excess of papers and noise before current AI models. When one prompt can produce the core of a plausible paper, reviewing and verification become a substantial burden. Formal verification in Lean, or an equivalent system, should become standard whenever a proof can be formalized.
2. Part of me hopes that this is somehow incorrect and that I have missed something significant. The Lean verification makes that increasingly unlikely.
3. I have not tested whether simpler prompts would also have solved this problem with 5.6 Sol Ultra. I therefore cannot say with certainty whether the result comes primarily from the model or the elaborate prompt, although my unsuccessful attempts with GPT 5.4, GPT 5.5, and Claude Opus 4.8 suggest that both matter.

</div>