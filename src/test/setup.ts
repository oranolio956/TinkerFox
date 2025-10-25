import '@testing-library/jest-dom';

// Mock Chrome APIs
Object.assign(global, {
  chrome: {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
    scripting: {
      executeScript: vi.fn(),
    },
    tabs: {
      get: vi.fn(),
    },
  },
});