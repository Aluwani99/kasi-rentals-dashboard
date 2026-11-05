import { describe, expect, it } from "vitest";
import { isSixDigitEmailOtp } from "./emailOtp";
import { countUnreadNotifications } from "./notifications";

describe("email OTP validation", () => {
  it("accepts exactly six numeric digits", () => {
    expect(isSixDigitEmailOtp("012345")).toBe(true);
  });

  it("rejects incomplete or non-numeric codes", () => {
    expect(isSixDigitEmailOtp("12345")).toBe(false);
    expect(isSixDigitEmailOtp("12a456")).toBe(false);
  });
});

describe("unread notification count", () => {
  it("counts unread notifications only", () => {
    expect(countUnreadNotifications([{ read_at: null }, { read_at: "2026-11-05T10:00:00Z" }, { read_at: null }])).toBe(2);
  });

  it("returns zero when there are no unread notifications", () => {
    expect(countUnreadNotifications([{ read_at: "2026-11-05T10:00:00Z" }])).toBe(0);
  });
});
