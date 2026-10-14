import type { FormSchema } from "./schema";

/** A small but complete form used across tests. */
export const tutoringIntake: FormSchema = {
  version: 1,
  id: "form_intake",
  title: "Tutoring intake",
  fields: [
    { id: "h1", type: "heading", label: "About you", required: false },
    { id: "name", type: "text", label: "Full name", required: true, maxLength: 80 },
    { id: "email", type: "email", label: "Email", required: true },
    { id: "age", type: "number", label: "Age", required: false, min: 5, max: 99, integer: true },
    {
      id: "level",
      type: "select",
      label: "Level",
      required: true,
      options: [
        { id: "gcse", label: "GCSE" },
        { id: "alevel", label: "A-level" },
      ],
    },
    { id: "board", type: "text", label: "Exam board", required: true, showIf: { fieldId: "level", equals: "alevel" } },
    { id: "hasReport", type: "checkbox", label: "I have a school report to share", required: false },
    { id: "report", type: "file", label: "School report", required: true, accept: ".pdf", maxSizeMb: 5, showIf: { fieldId: "hasReport", equals: true } },
    { id: "start", type: "date", label: "Preferred start", required: false, min: "2026-10-01" },
    { id: "consent", type: "checkbox", label: "I agree to the terms", required: true },
  ],
};
