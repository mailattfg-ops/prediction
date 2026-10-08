import { describe, expect, it } from "vitest";
import { determineOutcome, evaluatePrediction } from "@/lib/results";
import { getTemplates, renderParams, renderText, templateFor } from "@/lib/notifications/templates";

describe("winner determination is deterministic", () => {
  it("maps scores to HOME / AWAY / DRAW", () => {
    expect(determineOutcome(2, 1)).toBe("HOME");
    expect(determineOutcome(0, 3)).toBe("AWAY");
    expect(determineOutcome(1, 1)).toBe("DRAW");
    expect(determineOutcome(0, 0)).toBe("DRAW");
  });
  it("marks WINNER only when prediction equals the official outcome", () => {
    expect(evaluatePrediction("HOME", "HOME")).toBe("WINNER");
    expect(evaluatePrediction("AWAY", "HOME")).toBe("LOST");
    expect(evaluatePrediction("DRAW", "DRAW")).toBe("WINNER");
    expect(evaluatePrediction("DRAW", "AWAY")).toBe("LOST");
  });
  it("is stable across repeated calls (no randomness)", () => {
    for (let i = 0; i < 100; i++) expect(determineOutcome(3, 2)).toBe("HOME");
  });
});

describe("WhatsApp templates", () => {
  const vars = {
    name: "Rahul", home_team: "Manchester United", away_team: "Liverpool", predicted_team: "Manchester United",
    home_score: "2", away_score: "1", match_date: "8 Oct 2026", submission_time: "8 Oct 2026, 19:04", result: "Manchester United won",
  };
  it("renders positional parameters in template order", () => {
    const t = getTemplates().PREDICTION_WINNER;
    expect(renderParams(t, vars)).toEqual(["Rahul", "Manchester United", "2", "1", "Liverpool", "Manchester United"]);
  });
  it("uses the draw variant for draw winners", () => {
    expect(templateFor("PREDICTION_WINNER", { ...vars, predicted_team: "Draw" }).name).toBe("prediction_winner_draw");
    expect(templateFor("PREDICTION_WINNER", vars).name).toBe("prediction_winner");
  });
  it("strips newlines from parameters (Meta rejects them)", () => {
    const t = getTemplates().PREDICTION_SUBMITTED;
    expect(renderParams(t, { ...vars, name: "A\nB\t C" })[0]).toBe("A B C");
  });
  it("renders readable text for logs", () => {
    expect(renderText(getTemplates().PREDICTION_LOST, vars)).toContain("Manchester United 2 - 1 Liverpool");
  });
});
