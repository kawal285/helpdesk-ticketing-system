/*
 * Single point for text generation, mirroring embeddingService.js.
 *
 * Nothing outside this folder imports a chat provider directly, so moving
 * from Ollama to the college API is one line in .env.
 *
 * Two entry points:
 *   generate(messages, options)            one provider (GENERATION_PROVIDER),
 *                                          returns a string. Used by ticket
 *                                          classification. Unchanged.
 *   generateWithAgent(agent, messages, o)  the multi-agent path. Each agent
 *                                          (fast / main / think) names its own
 *                                          provider and model, and a failure
 *                                          falls back to a local model.
 */

const { getFallback } = require('./agentRouter');

const providers = {
  ollama: require('./providers/ollamaChat'),
  college: require('./providers/collegeChat'),
  groq: require('./providers/groqChat'),
};

const selected = process.env.GENERATION_PROVIDER || 'ollama';
const provider = providers[selected];

if (!provider) {
  throw new Error(
    `Unknown GENERATION_PROVIDER "${selected}". ` +
      `Available: ${Object.keys(providers).join(', ')}.`
  );
}

function getModelInfo() {
  return { provider: selected, name: provider.name };
}

/*
 * options are passed straight to the provider. Ticket classification uses
 * them to cap the reply length, because it needs three short lines rather
 * than a full answer -- which keeps it fast enough to run during ticket
 * creation.
 */
function generate(messages, options = {}) {
  if (!Array.isArray(messages) || !messages.length) {
    throw new Error('generate requires a non-empty messages array.');
  }

  return provider.generate(messages, options);
}

function providerFor(name) {
  const found = providers[name];

  if (!found) {
    throw new Error(
      `Unknown provider "${name}" in .env. Available: ${Object.keys(providers).join(', ')}.`
    );
  }

  return found;
}

/*
 * agent is the object from agentRouter.getAgent():
 *   { name, provider, model, temperature, think, reasoningEffort, ... }
 *
 * Returns { content, agent, provider, model, fellBack, fallbackReason }.
 * The caller shows agent/model in the UI, so it must be the model that
 * ACTUALLY answered -- after a fallback that is the local one.
 *
 * Fallback is never silent: it is logged with the reason. And an agent that
 * is already on the fallback provider+model is not retried against itself;
 * its error simply propagates.
 */
async function generateWithAgent(agent, messages, options = {}) {
  if (!agent || !agent.provider || !agent.model) {
    throw new Error('generateWithAgent requires an agent with a provider and model.');
  }

  if (!Array.isArray(messages) || !messages.length) {
    throw new Error('generateWithAgent requires a non-empty messages array.');
  }

  const primary = providerFor(agent.provider);

  try {
    const content = await primary.generate(messages, {
      model: agent.model,
      temperature: agent.temperature,
      think: agent.think,
      reasoningEffort: agent.reasoningEffort || undefined,
      maxTokens: agent.maxTokens || undefined,
      ...options,
    });

    return {
      content,
      agent: agent.name,
      provider: agent.provider,
      model: agent.model,
      fellBack: false,
      fallbackReason: null,
    };
  } catch (error) {
    const fallback = getFallback();
    const alreadyOnFallback =
      fallback.provider === agent.provider && fallback.model === agent.model;

    if (alreadyOnFallback) {
      throw error;
    }

    const reason = `${error.code || 'ERROR'}: ${error.message}`;

    console.warn(
      `[agents] ${agent.name} agent failed on ${agent.provider}/${agent.model} ` +
        `(${reason}). Falling back to ${fallback.provider}/${fallback.model}.`
    );

    // Fallback models are plain chat models: no reasoning flags.
    const content = await providerFor(fallback.provider).generate(messages, {
      model: fallback.model,
      temperature: agent.temperature,
      ...options,
    });

    return {
      content,
      agent: agent.name,
      provider: fallback.provider,
      model: fallback.model,
      fellBack: true,
      fallbackReason: reason,
    };
  }
}

module.exports = { generate, generateWithAgent, getModelInfo };