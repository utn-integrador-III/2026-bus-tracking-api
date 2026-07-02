"use strict";

const { z } = require("zod");

const name = z.string().trim().min(1).max(100);
const email = z.string().trim().email().max(150);
const password = z.string().min(8).max(100);
const phone = z.string().trim().min(8).max(30).optional();
const oauthProvider = z.enum(["google", "apple", "github"]);
const seniorDocumentContentType = z.enum(["image/jpeg", "image/png", "image/webp"]);

function isFutureDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00Z");
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return date > todayUTC;
}

function calculateAge(dateStr) {
  const birth = new Date(dateStr + "T00:00:00Z");
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

const birthDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "birth_date must use YYYY-MM-DD format." })
  .refine((val) => !isFutureDate(val), { message: "birth_date cannot be in the future." });

const registerPassengerSchema = z
  .object({
    name,
    email,
    password,
    phone,

    is_senior_request: z.boolean().optional().default(false),
    birth_date: birthDate.optional(),
    document_image_path: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.is_senior_request) {
      return;
    }

    if (!data.birth_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birth_date"],
        message: "birth_date is required for senior citizen requests.",
      });
    } else if (calculateAge(data.birth_date) < 65) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birth_date"],
        message: "birth_date must indicate an age of at least 65 years for senior citizen requests.",
      });
    }

    if (!data.document_image_path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["document_image_path"],
        message: "document_image_path is required for senior citizen requests.",
      });
    }
  });

const loginSchema = z
  .object({
    email,
    password,
  })
  .strict();

const oauthStartSchema = z
  .object({
    provider: oauthProvider,
    redirect_to: z.string().trim().url().optional(),
  })
  .strict();

const seniorDocumentUploadUrlSchema = z
  .object({
    email,
    file_name: z.string().trim().min(1).max(255),
    content_type: seniorDocumentContentType,
  })
  .strict();

module.exports = {
  registerPassengerSchema,
  loginSchema,
  oauthStartSchema,
  seniorDocumentUploadUrlSchema,
};
