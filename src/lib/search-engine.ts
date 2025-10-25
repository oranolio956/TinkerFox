// Advanced search and filtering engine for scripts
import Fuse from 'fuse.js';
import { UserScript } from '@/types';

export interface SearchFilters {
  query: string;
  enabled?: boolean;
  category?: string;
  tags?: string[];
  author?: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'runCount';
  sortOrder: 'asc' | 'desc';
}

export interface SearchResult {
  script: UserScript;
  score: number;
  highlights: {
    name?: string[];
    description?: string[];
    author?: string[];
  };
}

export class SearchEngine {
  private fuse: Fuse<UserScript>;
  private scripts: UserScript[] = [];

  constructor(scripts: UserScript[] = []) {
    this.scripts = scripts;
    this.initializeFuse();
  }

  private initializeFuse(): void {
    this.fuse = new Fuse(this.scripts, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'metadata.description', weight: 0.3 },
        { name: 'metadata.author', weight: 0.2 },
        { name: 'metadata.namespace', weight: 0.1 },
      ],
      threshold: 0.3, // Lower = more strict matching
      distance: 100,
      includeScore: true,
      includeMatches: true,
    });
  }

  updateScripts(scripts: UserScript[]): void {
    this.scripts = scripts;
    this.initializeFuse();
  }

  search(filters: SearchFilters): SearchResult[] {
    let results = [...this.scripts];

    // Apply filters
    if (filters.enabled !== undefined) {
      results = results.filter(script => script.enabled === filters.enabled);
    }

    if (filters.category) {
      results = results.filter(script => script.category === filters.category);
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(script => 
        filters.tags!.some(tag => script.tags?.includes(tag))
      );
    }

    if (filters.author) {
      results = results.filter(script => 
        script.metadata.author?.toLowerCase().includes(filters.author!.toLowerCase())
      );
    }

    // Apply text search
    if (filters.query.trim()) {
      const fuseResults = this.fuse.search(filters.query);
      const searchIds = new Set(fuseResults.map(r => r.item.id));
      results = results.filter(script => searchIds.has(script.id));
    }

    // Apply sorting
    results = this.sortScripts(results, filters.sortBy, filters.sortOrder);

    // Convert to search results with highlights
    return results.map(script => ({
      script,
      score: this.calculateScore(script, filters.query),
      highlights: this.extractHighlights(script, filters.query),
    }));
  }

  private sortScripts(
    scripts: UserScript[], 
    sortBy: SearchFilters['sortBy'], 
    sortOrder: SearchFilters['sortOrder']
  ): UserScript[] {
    return scripts.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'createdAt':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case 'updatedAt':
          aValue = a.updatedAt;
          bValue = b.updatedAt;
          break;
        case 'lastRunAt':
          aValue = a.lastRunAt || 0;
          bValue = b.lastRunAt || 0;
          break;
        case 'runCount':
          aValue = a.runCount;
          bValue = b.runCount;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  private calculateScore(script: UserScript, query: string): number {
    if (!query.trim()) return 1;

    const fuseResults = this.fuse.search(query);
    const result = fuseResults.find(r => r.item.id === script.id);
    return result ? (1 - (result.score || 0)) : 0;
  }

  private extractHighlights(script: UserScript, query: string): {
    name?: string[];
    description?: string[];
    author?: string[];
  } {
    if (!query.trim()) return {};

    const highlights: any = {};
    const queryLower = query.toLowerCase();

    // Highlight name matches
    if (script.name.toLowerCase().includes(queryLower)) {
      highlights.name = this.highlightText(script.name, query);
    }

    // Highlight description matches
    if (script.metadata.description?.toLowerCase().includes(queryLower)) {
      highlights.description = this.highlightText(script.metadata.description, query);
    }

    // Highlight author matches
    if (script.metadata.author?.toLowerCase().includes(queryLower)) {
      highlights.author = this.highlightText(script.metadata.author, query);
    }

    return highlights;
  }

  private highlightText(text: string, query: string): string[] {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.split(regex);
  }

  // Get search suggestions
  getSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    
    // Add script names that start with query
    this.scripts
      .filter(script => 
        script.name.toLowerCase().startsWith(query.toLowerCase())
      )
      .slice(0, limit)
      .forEach(script => suggestions.add(script.name));

    // Add authors that start with query
    this.scripts
      .filter(script => 
        script.metadata.author?.toLowerCase().startsWith(query.toLowerCase())
      )
      .slice(0, limit)
      .forEach(script => {
        if (script.metadata.author) {
          suggestions.add(script.metadata.author);
        }
      });

    return Array.from(suggestions).slice(0, limit);
  }

  // Get popular tags
  getPopularTags(limit: number = 10): { tag: string; count: number }[] {
    const tagCounts = new Map<string, number>();

    this.scripts.forEach(script => {
      script.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // Get categories
  getCategories(): string[] {
    const categories = new Set<string>();
    this.scripts.forEach(script => {
      if (script.category) {
        categories.add(script.category);
      }
    });
    return Array.from(categories).sort();
  }

  // Get statistics
  getStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    withTags: number;
    withCategories: number;
    averageRunCount: number;
  } {
    const total = this.scripts.length;
    const enabled = this.scripts.filter(s => s.enabled).length;
    const disabled = total - enabled;
    const withTags = this.scripts.filter(s => s.tags && s.tags.length > 0).length;
    const withCategories = this.scripts.filter(s => s.category).length;
    const averageRunCount = this.scripts.reduce((sum, s) => sum + s.runCount, 0) / total;

    return {
      total,
      enabled,
      disabled,
      withTags,
      withCategories,
      averageRunCount: Math.round(averageRunCount * 100) / 100,
    };
  }
}