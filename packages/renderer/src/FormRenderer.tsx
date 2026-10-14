import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Field, FormSchema } from "./schema";
import { fieldValidator, validateSubmission, visibleFieldIds, type FieldValue, type FormValues } from "./validation";

export type FormRendererProps = {
  form: FormSchema;
  /** Called with validated, normalised data (hidden fields removed). */
  onSubmit?: (data: Record<string, FieldValue>) => void | Promise<void>;
  initialValues?: FormValues;
  submitLabel?: string;
  /** Disables inputs and the submit button (e.g. while the host is saving). */
  disabled?: boolean;
  /** Extra content rendered above the submit button (e.g. a host's own fields). */
  children?: ReactNode;
};

/**
 * Renders a Formwise schema as an accessible HTML form. Errors show after a
 * field is left (blur) or on submit; conditional fields appear and disappear
 * as answers change.
 */
export function FormRenderer({ form, onSubmit, initialValues = {}, submitLabel = "Submit", disabled, children }: FormRendererProps) {
  const uid = useId();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const visible = useMemo(() => visibleFieldIds(form, values), [form, values]);

  const errorFor = (field: Field): string | undefined => {
    if (!touched[field.id]) return undefined;
    const result = fieldValidator(field).safeParse(values[field.id]);
    return result.success ? undefined : (result.error.issues[0]?.message ?? submitErrors[field.id]);
  };

  const setValue = (id: string, value: FieldValue) => setValues((v) => ({ ...v, [id]: value }));
  const touch = (id: string) => setTouched((t) => (t[id] ? t : { ...t, [id]: true }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateSubmission(form, values);
    if (!result.ok) {
      setSubmitErrors(result.errors);
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(result.errors).map((id) => [id, true])) }));
      const first = form.fields.find((f) => result.errors[f.id]);
      if (first) document.getElementById(`${uid}-${first.id}`)?.focus();
      return;
    }
    setSubmitErrors({});
    setSubmitting(true);
    try {
      await onSubmit?.(result.data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="fw-form" onSubmit={handleSubmit} noValidate aria-label={form.title || "Form"}>
      {form.title && <h2 className="fw-title">{form.title}</h2>}
      {form.description && <p className="fw-description">{form.description}</p>}
      {form.fields.map((field) =>
        visible.has(field.id) ? (
          <FieldControl
            key={field.id}
            field={field}
            inputId={`${uid}-${field.id}`}
            value={values[field.id]}
            error={errorFor(field)}
            disabled={disabled || submitting}
            onChange={(v) => setValue(field.id, v)}
            onBlur={() => touch(field.id)}
          />
        ) : null,
      )}
      {children}
      <button type="submit" className="fw-submit" disabled={disabled || submitting}>
        {submitting ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}

type ControlProps = {
  field: Field;
  inputId: string;
  value: FieldValue | undefined;
  error?: string;
  disabled?: boolean;
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
};

function FieldControl({ field, inputId, value, error, disabled, onChange, onBlur }: ControlProps) {
  if (field.type === "heading") {
    return (
      <div className="fw-heading">
        <h3>{field.label}</h3>
        {field.helpText && <p className="fw-help">{field.helpText}</p>}
      </div>
    );
  }

  const helpId = field.helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const common = {
    id: inputId,
    name: field.id,
    disabled,
    onBlur,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [helpId, errorId].filter(Boolean).join(" ") || undefined,
    "aria-required": field.required || undefined,
  } as const;
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";

  let control: ReactNode;
  switch (field.type) {
    case "text":
    case "email":
      control = (
        <input {...common} type={field.type} className="fw-input" value={text} placeholder={field.placeholder}
          maxLength={field.type === "text" ? field.maxLength : undefined} autoComplete={field.type === "email" ? "email" : undefined}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "textarea":
      control = (
        <textarea {...common} className="fw-input fw-textarea" rows={4} value={text} placeholder={field.placeholder}
          maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "number":
      control = (
        <input {...common} type="number" inputMode={field.integer ? "numeric" : "decimal"} className="fw-input" value={text}
          placeholder={field.placeholder} min={field.min} max={field.max} step={field.integer ? 1 : "any"}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "date":
      control = (
        <input {...common} type="date" className="fw-input" value={text} min={field.min} max={field.max}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "select":
      control = (
        <select {...common} className="fw-input" value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o.id} value={o.label}>{o.label}</option>
          ))}
        </select>
      );
      break;
    case "file":
      control = (
        <input {...common} type="file" className="fw-input fw-file" accept={field.accept || undefined}
          onChange={(e) => {
            const f = e.target.files?.[0];
            onChange(f ? { name: f.name, size: f.size, type: f.type } : null);
            onBlur();
          }} />
      );
      break;
    case "checkbox":
      return (
        <div className="fw-field fw-field-checkbox">
          <label className="fw-check">
            <input {...common} type="checkbox" checked={value === true}
              onChange={(e) => { onChange(e.target.checked); onBlur(); }} />
            <span>{field.label}{field.required && <span className="fw-req" aria-hidden="true"> *</span>}</span>
          </label>
          {field.helpText && <p id={helpId} className="fw-help">{field.helpText}</p>}
          {error && <p id={errorId} className="fw-error" role="alert">{error}</p>}
        </div>
      );
  }

  return (
    <div className="fw-field">
      <label htmlFor={inputId} className="fw-label">
        {field.label || "Untitled question"}
        {field.required && <span className="fw-req" aria-hidden="true"> *</span>}
      </label>
      {field.helpText && <p id={helpId} className="fw-help">{field.helpText}</p>}
      {control}
      {error && <p id={errorId} className="fw-error" role="alert">{error}</p>}
    </div>
  );
}
