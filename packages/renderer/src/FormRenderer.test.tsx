import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { FormFields, FormRenderer } from "./FormRenderer.js";
import type { FormValues } from "./validation.js";
import { tutoringIntake as form } from "./test-forms.js";

const setup = () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<FormRenderer form={form} onSubmit={onSubmit} />);
  return { user, onSubmit };
};

describe("<FormRenderer>", () => {
  it("renders labelled inputs and hides conditional ones", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Tutoring intake" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/Level/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Exam board/)).not.toBeInTheDocument();
  });

  it("shows a conditional field when its condition is met", async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText(/Level/), "A-level");
    expect(screen.getByLabelText(/Exam board/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Level/), "GCSE");
    expect(screen.queryByLabelText(/Exam board/)).not.toBeInTheDocument();
  });

  it("blocks submit, shows every error and focuses the first invalid field", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      "This field is required",
      "This field is required",
      "This field is required",
      "This field is required",
    ]);
    expect(screen.getByLabelText(/Full name/)).toHaveFocus();
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute("aria-invalid", "true");
  });

  it("validates a field when it loses focus", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/^Email/), "nope");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");
  });

  it("submits normalised data without hidden answers", async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/Level/), "A-level");
    await user.type(screen.getByLabelText(/Exam board/), "AQA");
    await user.selectOptions(screen.getByLabelText(/Level/), "GCSE"); // hides board again
    await user.type(screen.getByLabelText(/Full name/), " Sam ");
    await user.type(screen.getByLabelText(/^Email/), "sam@example.com");
    await user.type(screen.getByLabelText(/Age/), "15");
    await user.click(screen.getByLabelText(/I agree/));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      name: "Sam",
      email: "sam@example.com",
      age: 15,
      level: "GCSE",
      hasReport: false,
      start: null,
      consent: true,
    });
  });

  it("captures file metadata only", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText(/school report to share/));
    const file = new File(["%PDF"], "report.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/^School report/), file);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("<FormFields>", () => {
  function Host({ onValues }: { onValues: (v: Record<string, unknown>) => void }) {
    const [values, setValues] = useState<FormValues>({});
    return (
      <form aria-label="Host form">
        <FormFields
          form={form}
          values={values}
          errors={{ name: "Server says no" }}
          theme="light"
          onChange={(id, v) => {
            const next = { ...values, [id]: v };
            setValues(next);
            onValues(next);
          }}
        />
      </form>
    );
  }

  it("renders questions without its own form or button, inside a host form", () => {
    render(<Host onValues={() => {}} />);
    expect(screen.getAllByRole("form")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toBeInTheDocument();
    expect(document.querySelector(".fw-root")).toHaveAttribute("data-theme", "light");
  });

  it("shows host-provided errors and reports changes, with conditions applied", async () => {
    const onValues = vi.fn();
    const user = userEvent.setup();
    render(<Host onValues={onValues} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Server says no");
    await user.selectOptions(screen.getByLabelText(/Level/), "A-level");
    expect(onValues).toHaveBeenLastCalledWith({ level: "A-level" });
    expect(screen.getByLabelText(/Exam board/)).toBeInTheDocument();
  });
});
