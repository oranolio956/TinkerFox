// Input validation schemas using Zod
import { z } from 'zod';

// Base validation schemas
export const ScriptIdSchema = z.string().min(1).max(100);
export const ScriptCodeSchema = z.string().min(1).max(1000000); // Max 1MB
export const ChangelogSchema = z.string().max(500).optional();
export const UrlSchema = z.string().url().max(2000);
export const TabIdSchema = z.number().int().positive();
export const FilterSchema = z.string().max(100).optional();

// Script metadata validation
export const ScriptMetadataSchema = z.object({
  name: z.string().min(1).max(200),
  namespace: z.string().max(100).optional(),
  version: z.string().max(50),
  description: z.string().max(1000).optional(),
  author: z.string().max(200).optional(),
  match: z.array(z.string().max(500)).min(1),
  include: z.array(z.string().max(500)).optional(),
  exclude: z.array(z.string().max(500)).optional(),
  require: z.array(z.string().url().max(2000)).optional(),
  grant: z.array(z.string().max(100)).optional(),
  runAt: z.enum(['document-start', 'document-end', 'document-idle']).optional(),
  noframes: z.boolean().optional(),
  updateURL: z.string().url().max(2000).optional(),
  downloadURL: z.string().url().max(2000).optional(),
  icon: z.string().url().max(2000).optional(),
  homepageURL: z.string().url().max(2000).optional(),
  supportURL: z.string().url().max(2000).optional(),
});

// Message validation schemas
export const GetAllScriptsMessageSchema = z.object({
  type: z.literal('GET_ALL_SCRIPTS'),
});

export const GetScriptsForTabMessageSchema = z.object({
  type: z.literal('GET_SCRIPTS_FOR_TAB'),
  tabId: TabIdSchema,
});

export const GetScriptsForUrlMessageSchema = z.object({
  type: z.literal('GET_SCRIPTS_FOR_URL'),
  url: UrlSchema,
});

export const CreateScriptMessageSchema = z.object({
  type: z.literal('CREATE_SCRIPT'),
  code: ScriptCodeSchema,
});

export const UpdateScriptMessageSchema = z.object({
  type: z.literal('UPDATE_SCRIPT'),
  id: ScriptIdSchema,
  code: ScriptCodeSchema,
  changelog: ChangelogSchema,
});

export const DeleteScriptMessageSchema = z.object({
  type: z.literal('DELETE_SCRIPT'),
  id: ScriptIdSchema,
});

export const ToggleScriptMessageSchema = z.object({
  type: z.literal('TOGGLE_SCRIPT'),
  id: ScriptIdSchema,
});

export const InjectScriptMessageSchema = z.object({
  type: z.literal('INJECT_SCRIPT'),
  script: z.object({
    id: ScriptIdSchema,
    code: ScriptCodeSchema,
    grants: z.array(z.string().max(100)),
  }),
  grants: z.array(z.string().max(100)),
});

export const InjectLibraryMessageSchema = z.object({
  type: z.literal('INJECT_LIBRARY'),
  url: UrlSchema,
  code: ScriptCodeSchema,
});

export const GetExecutionLogsMessageSchema = z.object({
  type: z.literal('GET_EXECUTION_LOGS'),
  filter: FilterSchema,
});

export const GMXHRRequestMessageSchema = z.object({
  type: z.literal('GM_XHR_REQUEST'),
  details: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).optional(),
    url: UrlSchema,
    headers: z.record(z.string().max(100), z.string().max(1000)).optional(),
    data: z.any().optional(),
  }),
});

export const GMNotificationMessageSchema = z.object({
  type: z.literal('GM_NOTIFICATION'),
  options: z.object({
    text: z.string().min(1).max(500),
    title: z.string().max(100).optional(),
    image: z.string().url().max(2000).optional(),
    onclick: z.function().optional(),
  }),
});

export const PingMessageSchema = z.object({
  type: z.literal('PING'),
});

export const ScriptInjectionErrorMessageSchema = z.object({
  type: z.literal('SCRIPT_INJECTION_ERROR'),
  scriptId: ScriptIdSchema,
  error: z.string().max(1000),
});

// Union schema for all messages
export const MessageSchema = z.discriminatedUnion('type', [
  GetAllScriptsMessageSchema,
  GetScriptsForTabMessageSchema,
  GetScriptsForUrlMessageSchema,
  CreateScriptMessageSchema,
  UpdateScriptMessageSchema,
  DeleteScriptMessageSchema,
  ToggleScriptMessageSchema,
  InjectScriptMessageSchema,
  InjectLibraryMessageSchema,
  GetExecutionLogsMessageSchema,
  GMXHRRequestMessageSchema,
  GMNotificationMessageSchema,
  PingMessageSchema,
  ScriptInjectionErrorMessageSchema,
]);

// Validation helper functions
export function validateMessage(message: unknown): { success: true; data: any } | { success: false; error: string } {
  try {
    const validated = MessageSchema.parse(message);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Validation failed';
      return { success: false, error: `Validation failed: ${errorMessage}` };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

// Sanitization helpers
export function sanitizeScriptCode(code: string): string {
  // Remove control characters except newlines and tabs
  return code.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function sanitizeScriptName(name: string): string {
  return name
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s\-_.]/g, '') // Keep only alphanumeric, spaces, hyphens, underscores, dots
    .trim()
    .slice(0, 200); // Limit length
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid protocol') {
      throw error;
    }
    throw new Error('Invalid URL format');
  }
}