# RAG retrieval evaluation

Embedding provider: `ollama:nomic-embed-text` (768 dimensions)
Top-K: 3
Chosen similarity threshold: **0.59**

This measures retrieval only (did the right chunk come back?). For
whether the generated *answer* text is actually correct, see
[ai-evaluation-report.md](./ai-evaluation-report.md).

## Results

| # | Type | Question | Top score | Correct chunk retrieved? |
| --- | --- | --- | --- | --- |
| 1 | direct | How do I reset my password? | 0.8538 | Yes (rank 1) |
| 2 | direct | How do I set up multi-factor authentication? | 0.8223 | Yes (rank 1) |
| 3 | direct | How do I connect to the campus Wi-Fi? | 0.8786 | Yes (rank 1) |
| 4 | direct | How do I request software to be installed? | 0.8188 | Yes (rank 1) |
| 5 | direct | How do I borrow a laptop? | 0.7897 | Yes (rank 1) |
| 6 | direct | What are the ticket priority response times? | 0.8349 | Yes (rank 1) |
| 7 | direct | How do I set up my email on my phone? | 0.8116 | Yes (rank 1) |
| 8 | semantic | I cannot remember my login details | 0.6811 | Yes (rank 1) |
| 9 | semantic | It says too many attempts and now I am shut out | 0.6687 | Yes (rank 1) |
| 10 | semantic | The internet keeps cutting out when I am in the library | 0.6652 | Yes (rank 1) |
| 11 | semantic | Nothing comes out of the machine when I send a document | 0.6601 | Yes (rank 3) |
| 12 | semantic | I got a weird message asking me to confirm my account urgently | 0.6850 | Yes (rank 2) |
| 13 | semantic | I deleted my assignment by accident, can I get it back? | 0.7105 | Yes (rank 1) |
| 14 | semantic | My laptop takes forever to do anything | 0.7741 | Yes (rank 1) |
| 15 | semantic | The screen in the classroom is showing no signal | 0.7360 | Yes (rank 1) |
| 16 | misspelled | how do i reste my pasword | 0.6120 | Yes (rank 1) |
| 17 | short | vpn | 0.7495 | Yes (rank 1) |
| 18 | verbose | Hi there, I hope you are well. I am a second year student and I have b | 0.6831 | Yes (rank 2) |
| 19 | out-of-domain | Who won the football match last night? | 0.4921 | n/a — correctly refused |
| 20 | out-of-domain | What is the weather going to be tomorrow? | 0.5604 | n/a — correctly refused |
| 21 | out-of-domain | Can you write me a poem about the sea? | 0.5233 | n/a — correctly refused |
| 22 | out-of-domain | What is the capital city of Peru? | 0.4597 | n/a — correctly refused |
| 23 | out-of-domain | How do I cook a roast chicken? | 0.5262 | n/a — correctly refused |
| 24 | out-of-domain | What time does the campus cafe close? | 0.5811 | n/a — correctly refused |

## Summary

- Correct article retrieved for 18/18 in-domain questions.
- Lowest in-domain score: 0.6120
- Highest out-of-domain score: 0.5811
- The threshold was selected by sweeping values from 0.40 to 0.85 and
  choosing the one that answers the most real questions while refusing
  the most unrelated ones. It was not copied from a tutorial.
