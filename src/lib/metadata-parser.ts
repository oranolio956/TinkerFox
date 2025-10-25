import { ScriptMetadata } from '@/types';

export function parseMetadata(code: string): ScriptMetadata {
  const metadata: Partial<ScriptMetadata> = {
    match: [],
    include: [],
    exclude: [],
    require: [],
    grant: [],
    runAt: 'document-idle',
    noframes: false,
  };
  
  // Extract metadata block
  const metadataMatch = code.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
  if (!metadataMatch) {
    throw new Error('Invalid userscript: missing metadata block');
  }
  
  const metadataBlock = metadataMatch[1];
  const lines = metadataBlock.split('\n');
  
  for (const line of lines) {
    const match = line.match(/\/\/ @(\w+)\s+(.+)/);
    if (!match) continue;
    
    const [, key, value] = match;
    const trimmedValue = value.trim();
    
    switch (key) {
      case 'name':
        metadata.name = sanitizeString(trimmedValue);
        break;
        
      case 'namespace':
        metadata.namespace = sanitizeString(trimmedValue);
        break;
        
      case 'version':
        metadata.version = sanitizeVersion(trimmedValue);
        break;
        
      case 'description':
        metadata.description = sanitizeString(trimmedValue);
        break;
        
      case 'author':
        metadata.author = sanitizeString(trimmedValue);
        break;
        
      case 'match':
        if (validateMatchPattern(trimmedValue)) {
          metadata.match!.push(trimmedValue);
        } else {
          console.warn(`Invalid @match pattern: ${trimmedValue}`);
        }
        break;
        
      case 'include':
        if (validateMatchPattern(trimmedValue)) {
          metadata.include!.push(trimmedValue);
        }
        break;
        
      case 'exclude':
        if (validateMatchPattern(trimmedValue)) {
          metadata.exclude!.push(trimmedValue);
        }
        break;
        
      case 'require':
        if (validateRequireUrl(trimmedValue)) {
          metadata.require!.push(trimmedValue);
        } else {
          console.warn(`Invalid @require URL: ${trimmedValue}`);
        }
        break;
        
      case 'grant':
        if (validateGrant(trimmedValue)) {
          metadata.grant!.push(trimmedValue);
        } else {
          console.warn(`Invalid @grant value: ${trimmedValue}`);
        }
        break;
        
      case 'run-at':
        if (trimmedValue === 'document-start' || trimmedValue === 'document-end' || trimmedValue === 'document-idle') {
          metadata.runAt = trimmedValue;
        }
        break;
        
      case 'noframes':
        metadata.noframes = true;
        break;
    }
  }
  
  // Validate required fields
  if (!metadata.name) {
    throw new Error('Script must have @name');
  }
  
  if (metadata.match!.length === 0 && metadata.include!.length === 0) {
    throw new Error('Script must have at least one @match or @include pattern');
  }
  
  return metadata as ScriptMetadata;
}

// Sanitize string (prevent XSS in script names)
function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 200);  // Max length
}

// Validate version string
function sanitizeVersion(version: string): string {
  // Allow only semver format (1.2.3)
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return '1.0.0';
  return version;
}

// Validate match pattern
function validateMatchPattern(pattern: string): boolean {
  // Basic validation (full regex match would be complex)
  if (pattern.length > 500) return false;  // Prevent DoS
  
  // Must start with scheme
  if (!pattern.match(/^(\*|https?|file|ftp):\/\//)) return false;
  
  // No dangerous patterns
  if (pattern.includes('<script>') || pattern.includes('javascript:')) return false;
  
  return true;
}

// Validate @require URL
function validateRequireUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS (security)
    if (parsed.protocol !== 'https:') return false;
    
    // Whitelist known CDNs (prevent malicious scripts)
    const allowedDomains = [
      'cdn.jsdelivr.net',
      'cdnjs.cloudflare.com',
      'unpkg.com',
      'code.jquery.com',
    ];
    
    return allowedDomains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
    
  } catch {
    return false;
  }
}

// Validate @grant value
function validateGrant(grant: string): boolean {
  const allowedGrants = [
    'GM_getValue',
    'GM_setValue',
    'GM_deleteValue',
    'GM_listValues',
    'GM_xmlhttpRequest',
    'GM_addStyle',
    'GM_setClipboard',
    'GM_notification',
    'GM.getValue',
    'GM.setValue',
    'GM.deleteValue',
    'GM.listValues',
    'GM.xmlHttpRequest',
    'unsafeWindow',
    'window.close',
    'window.focus',
  ];
  
  return allowedGrants.includes(grant);
}