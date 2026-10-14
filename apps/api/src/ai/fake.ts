import type { DraftForm } from "./draft.js";
import type { CallModel } from "./generate.js";

/**
 * A deterministic stand-in for the model, used by the local e2e server
 * (FORMWISE_FAKE_AI=1) so browser tests never spend API credits.
 */
export const fakeModel: CallModel = async ({ description }) => {
  const draft: DraftForm = {
    title: description.slice(0, 60).replace(/^\w/, (c) => c.toUpperCase()),
    fields: [
      { key: "name", type: "text", label: "Your name", required: true },
      { key: "email", type: "email", label: "Email", required: true },
      { key: "topic", type: "select", label: "Topic", required: true, options: ["Maths", "Physics", "Other"] },
      { key: "other", type: "text", label: "Which topic?", required: true, showIf: { key: "topic", equals: "Other" } },
    ],
  };
  return { toolInput: draft, toolUseId: "toolu_fake", assistantContent: [], inputTokens: 0, outputTokens: 0 };
};
