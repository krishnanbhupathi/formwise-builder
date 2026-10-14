import type { FormSchema } from "@formwise/renderer";

/** The form the builder opens with, so there's something to play with. */
export const sampleForm: FormSchema = {
  version: 1,
  id: "form_sample",
  title: "Tutoring intake",
  description: "Tell us a little about the student before the first lesson.",
  fields: [
    { id: "f_name", type: "text", label: "Student's name", required: true, maxLength: 80 },
    { id: "f_email", type: "email", label: "Parent or student email", required: true },
    {
      id: "f_level",
      type: "select",
      label: "Level",
      required: true,
      options: [
        { id: "o_gcse", label: "GCSE" },
        { id: "o_alevel", label: "A-level" },
        { id: "o_other", label: "Other" },
      ],
    },
    { id: "f_board", type: "text", label: "Exam board", required: false, placeholder: "e.g. AQA", showIf: { fieldId: "f_level", equals: "o_alevel" } },
    { id: "f_goals", type: "textarea", label: "What would you like to work on?", required: false, maxLength: 1000 },
    { id: "f_consent", type: "checkbox", label: "I agree to lessons being scheduled by email", required: true },
  ],
};
