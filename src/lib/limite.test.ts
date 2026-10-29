import { describe, expect, it } from "vitest";
import { adresseIp, autoriser } from "./limite";

describe("limite de débit", () => {
  it("autorise jusqu'au quota puis refuse", () => {
    const cle = `test:${Math.random()}`;
    expect(autoriser(cle, 3, 60)).toBe(true);
    expect(autoriser(cle, 3, 60)).toBe(true);
    expect(autoriser(cle, 3, 60)).toBe(true);
    expect(autoriser(cle, 3, 60)).toBe(false);
  });

  it("isole les clés entre elles", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    expect(autoriser(a, 1, 60)).toBe(true);
    expect(autoriser(a, 1, 60)).toBe(false);
    expect(autoriser(b, 1, 60)).toBe(true);
  });

  it("lit la première IP de x-forwarded-for", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
    expect(adresseIp(req)).toBe("203.0.113.9");
    expect(adresseIp(new Request("http://x"))).toBe("inconnue");
  });
});
