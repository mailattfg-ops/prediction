import type { NotificationType } from "@prisma/client";

/**
 * WhatsApp Cloud API only delivers business-initiated messages through pre-approved templates.
 * Each entry maps an event to the template registered in Meta Business Manager and lists the
 * variables in the order of the template's positional parameters ({{1}}, {{2}}, ...).
 * `text` mirrors the approved copy and is used for dry-run logs and the admin preview.
 */
export type TemplateVars = {
  name: string;
  home_team: string;
  away_team: string;
  predicted_team: string;
  home_score: string;
  away_score: string;
  match_date: string;
  submission_time: string;
  result: string;
  predicted_score: string;
};

export type TemplateKey = NotificationType | "PREDICTION_WINNER_DRAW";

export type TemplateConfig = {
  name: string;
  language: string;
  variables: (keyof TemplateVars)[];
  text: string;
};

const env = (key: string, fallback: string) => process.env[key] || fallback;
const language = () => env("WHATSAPP_TEMPLATE_LANGUAGE", "en");

export function getTemplates(): Record<TemplateKey, TemplateConfig> {
  return {
    PREDICTION_SUBMITTED: {
      name: env("WHATSAPP_TEMPLATE_SUBMITTED", "prediction_submitted"),
      language: language(),
      variables: ["name", "home_team", "away_team", "predicted_team", "submission_time"],
      text:
        "Hello {{name}}, your football prediction has been successfully submitted. " +
        "⚽ Match: {{home_team}} vs {{away_team}}. Your prediction: {{predicted_team}}. " +
        "Prediction submitted at: {{submission_time}}. We will notify you when the match result is available. Thank you for participating!",
    },
    PREDICTION_WINNER: {
      name: env("WHATSAPP_TEMPLATE_WINNER", "prediction_winner"),
      language: language(),
      variables: ["name", "home_team", "home_score", "away_score", "away_team", "predicted_team"],
      text:
        "Hello {{name}}, 🎉 Congratulations! Your prediction was correct. " +
        "⚽ {{home_team}} {{home_score}} - {{away_score}} {{away_team}}. Your prediction: {{predicted_team}}. " +
        "Result: CORRECT PREDICTION. Thank you for participating!",
    },
    PREDICTION_WINNER_DRAW: {
      name: env("WHATSAPP_TEMPLATE_WINNER_DRAW", "prediction_winner_draw"),
      language: language(),
      variables: ["name", "home_team", "home_score", "away_score", "away_team"],
      text:
        "Hello {{name}}, ⚽ The match has ended. {{home_team}} {{home_score}} - {{away_score}} {{away_team}}. " +
        "Your prediction: Draw. 🎉 Your prediction was correct!",
    },
    PREDICTION_LOST: {
      name: env("WHATSAPP_TEMPLATE_LOST", "prediction_lost"),
      language: language(),
      variables: ["name", "home_team", "home_score", "away_score", "away_team", "predicted_team"],
      text:
        "Hello {{name}}, the result is in! ⚽ {{home_team}} {{home_score}} - {{away_score}} {{away_team}}. " +
        "Your prediction: {{predicted_team}}. Unfortunately, your prediction was not correct this time. Thank you for participating!",
    },
    SCORE_WINNER: {
      name: env("WHATSAPP_TEMPLATE_SCORE_WINNER", "score_winner"),
      language: language(),
      variables: ["name", "home_team", "home_score", "away_score", "away_team"],
      text:
        "Hello {{name}}, 🏆 You predicted the exact score! ⚽ {{home_team}} {{home_score}} - {{away_score}} {{away_team}}. " +
        "You have been selected as the score winner. We will contact you about your prize. Thank you for participating!",
    },
    RESULT_ANNOUNCEMENT: {
      name: env("WHATSAPP_TEMPLATE_RESULT", "result_announcement"),
      language: language(),
      variables: ["name", "home_team", "home_score", "away_score", "away_team", "result"],
      text:
        "Hello {{name}}, the match has ended. ⚽ {{home_team}} {{home_score}} - {{away_score}} {{away_team}}. " +
        "Result: {{result}}. Thank you for participating!",
    },
  };
}

export function templateFor(type: NotificationType, vars: Partial<TemplateVars>): TemplateConfig {
  const t = getTemplates();
  if (type === "PREDICTION_WINNER" && vars.predicted_team === "Draw") return t.PREDICTION_WINNER_DRAW;
  return t[type];
}

/** Meta rejects parameters containing newlines, tabs or more than four consecutive spaces. */
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export const renderParams = (t: TemplateConfig, vars: Partial<TemplateVars>): string[] =>
  t.variables.map((k) => clean(vars[k] ?? ""));

export const renderText = (t: TemplateConfig, vars: Partial<TemplateVars>): string =>
  t.text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k as keyof TemplateVars] ?? "");
