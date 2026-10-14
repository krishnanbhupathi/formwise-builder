import { describe, expect, it } from "vitest";
import { parseRoute } from "./router";

describe("parseRoute", () => {
  it.each([
    ["/", { name: "new" }],
    ["/forms", { name: "forms" }],
    ["/edit/abc", { name: "edit", id: "abc" }],
    ["/edit/abc/", { name: "edit", id: "abc" }],
    ["/edit/abc/submissions", { name: "submissions", id: "abc" }],
    ["/f/abc", { name: "fill", id: "abc" }],
    ["/f", { name: "notFound" }],
    ["/edit/abc/other", { name: "notFound" }],
  ])("%s", (path, route) => expect(parseRoute(path)).toEqual(route));
});
