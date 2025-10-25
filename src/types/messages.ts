// Message type definitions for ScriptFlow extension

export enum MessageType {
  // Script management
  GET_ALL_SCRIPTS = 'GET_ALL_SCRIPTS',
  GET_SCRIPTS_FOR_TAB = 'GET_SCRIPTS_FOR_TAB',
  GET_SCRIPTS_FOR_URL = 'GET_SCRIPTS_FOR_URL',
  CREATE_SCRIPT = 'CREATE_SCRIPT',
  UPDATE_SCRIPT = 'UPDATE_SCRIPT',
  DELETE_SCRIPT = 'DELETE_SCRIPT',
  TOGGLE_SCRIPT = 'TOGGLE_SCRIPT',
  
  // Execution
  INJECT_SCRIPT = 'INJECT_SCRIPT',
  INJECT_LIBRARY = 'INJECT_LIBRARY',
  GET_EXECUTION_LOGS = 'GET_EXECUTION_LOGS',
  
  // GM API
  GM_XHR_REQUEST = 'GM_XHR_REQUEST',
  GM_NOTIFICATION = 'GM_NOTIFICATION',
  
  // System
  PING = 'PING',
  SCRIPT_INJECTION_ERROR = 'SCRIPT_INJECTION_ERROR',
}

// Base message interface
export interface BaseMessage {
  type: MessageType;
}

// Script management messages
export interface GetAllScriptsMessage extends BaseMessage {
  type: MessageType.GET_ALL_SCRIPTS;
}

export interface GetScriptsForTabMessage extends BaseMessage {
  type: MessageType.GET_SCRIPTS_FOR_TAB;
  tabId: number;
}

export interface GetScriptsForUrlMessage extends BaseMessage {
  type: MessageType.GET_SCRIPTS_FOR_URL;
  url: string;
}

export interface CreateScriptMessage extends BaseMessage {
  type: MessageType.CREATE_SCRIPT;
  code: string;
}

export interface UpdateScriptMessage extends BaseMessage {
  type: MessageType.UPDATE_SCRIPT;
  id: string;
  code: string;
  changelog?: string;
}

export interface DeleteScriptMessage extends BaseMessage {
  type: MessageType.DELETE_SCRIPT;
  id: string;
}

export interface ToggleScriptMessage extends BaseMessage {
  type: MessageType.TOGGLE_SCRIPT;
  id: string;
}

// Execution messages
export interface InjectScriptMessage extends BaseMessage {
  type: MessageType.INJECT_SCRIPT;
  script: {
    id: string;
    code: string;
    grants: string[];
  };
  grants: string[];
}

export interface InjectLibraryMessage extends BaseMessage {
  type: MessageType.INJECT_LIBRARY;
  url: string;
  code: string;
}

export interface GetExecutionLogsMessage extends BaseMessage {
  type: MessageType.GET_EXECUTION_LOGS;
  filter?: string;
}

// GM API messages
export interface GMXHRRequestMessage extends BaseMessage {
  type: MessageType.GM_XHR_REQUEST;
  details: {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    data?: any;
  };
}

export interface GMNotificationMessage extends BaseMessage {
  type: MessageType.GM_NOTIFICATION;
  options: {
    text: string;
    title?: string;
    image?: string;
    onclick?: () => void;
  };
}

// System messages
export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
}

export interface ScriptInjectionErrorMessage extends BaseMessage {
  type: MessageType.SCRIPT_INJECTION_ERROR;
  scriptId: string;
  error: string;
}

// Union type for all messages
export type Message = 
  | GetAllScriptsMessage
  | GetScriptsForTabMessage
  | GetScriptsForUrlMessage
  | CreateScriptMessage
  | UpdateScriptMessage
  | DeleteScriptMessage
  | ToggleScriptMessage
  | InjectScriptMessage
  | InjectLibraryMessage
  | GetExecutionLogsMessage
  | GMXHRRequestMessage
  | GMNotificationMessage
  | PingMessage
  | ScriptInjectionErrorMessage;

// Response types
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  scripts?: any[];
  script?: any;
  logs?: any[];
  response?: any;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type MessageResponse<T = any> = SuccessResponse<T> | ErrorResponse;