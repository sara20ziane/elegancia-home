import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { translate, type TranslationKey } from "./i18n";

const ROUTES = join(process.cwd(), "src", "routes");
// The owner's screens are written for the owner, so their titles stay Arabic.
const OWNER_ONLY = /^(admin|login|setup)/;
const ARABIC = /[؀-ۿ]/;

describe("storefront page titles", () => {
  it("are never hardcoded Arabic, so an English or French visitor does not get an Arabic tab", () => {
    const offenders = readdirSync(ROUTES)
      .filter((file) => file.endsWith(".tsx") && !OWNER_ONLY.test(file))
      .flatMap((file) => {
        const source = ts.createSourceFile(
          file,
          readFileSync(join(ROUTES, file), "utf8"),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        const found: string[] = [];
        const visit = (node: ts.Node, inHead = false) => {
          const property = ts.isPropertyAssignment(node) ? node : null;
          const key = property?.name.getText(source);
          const inside = inHead || key === "head";
          if (
            inside &&
            property &&
            ["title", "content"].includes(key ?? "") &&
            ts.isStringLiteral(property.initializer) &&
            ARABIC.test(property.initializer.text)
          )
            found.push(`${file}: ${property.getText(source)}`);
          ts.forEachChild(node, (child) => visit(child, inside));
        };
        visit(source);
        return found;
      });
    expect(offenders).toEqual([]);
  });

  it("translate to a Latin title in French and English", () => {
    const keys: TranslationKey[] = [
      "nav.products",
      "catalogue.description",
      "checkout.title",
      "order.title",
      "search.title",
    ];
    for (const key of keys) {
      for (const locale of ["fr", "en"] as const) {
        expect(translate(locale, key)).not.toMatch(ARABIC);
      }
    }
  });
});
