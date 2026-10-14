import { FormRenderer } from "@formwise/renderer";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { emptyForm } from "../state/commands";
import { useBuilder } from "../state/store";
import { UndoRedo } from "./UndoRedo";

const s = () => useBuilder.getState();
const ids = () => s().form.fields.map((f) => f.id);

beforeEach(() => {
  s().load(emptyForm("f"));
  s().dispatch({ type: "addField", fieldType: "text", id: "a" });
  s().dispatch({ type: "addField", fieldType: "text", id: "b" });
});

describe("<UndoRedo>", () => {
  it("buttons undo and redo, and disable at the ends", () => {
    render(<UndoRedo />);
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(redo).toBeDisabled();
    fireEvent.click(undo);
    fireEvent.click(undo);
    expect(ids()).toEqual([]);
    expect(undo).toBeDisabled();
    fireEvent.click(redo);
    expect(ids()).toEqual(["a"]);
  });

  it("handles Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y", () => {
    render(<UndoRedo />);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(ids()).toEqual(["a"]);
    fireEvent.keyDown(window, { key: "Z", ctrlKey: true, shiftKey: true });
    expect(ids()).toEqual(["a", "b"]);
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(ids()).toEqual(["a", "b"]);
  });

  it("leaves Ctrl+Z alone while typing in the preview form", () => {
    render(
      <>
        <UndoRedo />
        <FormRenderer form={{ ...emptyForm("p"), fields: [{ id: "q", type: "text", label: "Q", required: false }] }} />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("Q"), { key: "z", ctrlKey: true });
    expect(ids()).toEqual(["a", "b"]);
  });
});
