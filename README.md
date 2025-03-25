# codenAImes
Codenames where you give the clues and an LLM guesses.

# ideas
- increase selection of words
- use text embeddings instead of going to llm for each request, should be able to pre-generate embeddings for each word so we only have to call external API for the clue word (can even cache those embeddings though)