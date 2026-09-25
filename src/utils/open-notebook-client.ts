/**
 * REST API Client for Open Notebook (lfnovo/open-notebook).
 *
 * Provides typed methods for interacting with notebooks and sources
 * hosted on an Open Notebook instance (FastAPI backend on port 5055).
 */

export interface NotebookItem {
  id: string;
  name: string;
  description?: string;
  created?: string;
  updated?: string;
  source_count?: number;
  note_count?: number;
  [key: string]: any;
}

export interface SourceItem {
  id: string;
  title: string;
  url?: string;
  notebook_id?: string;
  created?: string;
  updated?: string;
  [key: string]: any;
}

export interface CreateSourceOptions {
  notebookId: string;
  title: string;
  text: string;
  url?: string;
  processAsync?: boolean;
}

export interface OpenNotebookClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

export class OpenNotebookClient {
  public readonly baseUrl: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  constructor(options: OpenNotebookClientOptions = {}) {
    const rawUrl = options.baseUrl || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
    let normalized = rawUrl.replace(/\/+$/, '');
    if (normalized.endsWith('/api')) {
      normalized = normalized.slice(0, -4);
    }
    this.baseUrl = normalized;
    this.apiKey = options.apiKey || process.env.OPEN_NOTEBOOK_API_KEY;
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Checks whether the Open Notebook API server is reachable and responsive.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (res.ok) return true;

      // Fallback: check /api/notebooks
      const fallback = await this.fetchFn(`${this.baseUrl}/api/notebooks`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return fallback.ok || fallback.status === 401;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves all notebooks.
   */
  async listNotebooks(): Promise<NotebookItem[]> {
    const res = await this.fetchFn(`${this.baseUrl}/api/notebooks`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list notebooks from Open Notebook (${res.status} ${res.statusText})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).items)) return (data as any).items;
    if (Array.isArray((data as any).notebooks)) return (data as any).notebooks;
    return [];
  }

  /**
   * Retrieves a specific notebook by ID.
   */
  async getNotebook(id: string): Promise<NotebookItem | null> {
    const res = await this.fetchFn(`${this.baseUrl}/api/notebooks/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to get notebook '${id}' (${res.status} ${res.statusText})`);
    }
    return (await res.json()) as NotebookItem;
  }

  /**
   * Finds a notebook by its human-readable name.
   */
  async findNotebookByName(name: string): Promise<NotebookItem | null> {
    const notebooks = await this.listNotebooks();
    return notebooks.find((nb) => nb.name === name) || null;
  }

  /**
   * Creates a new notebook.
   */
  async createNotebook(name: string, description?: string): Promise<NotebookItem> {
    const res = await this.fetchFn(`${this.baseUrl}/api/notebooks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, description: description || '' }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to create notebook '${name}' (${res.status}: ${errText || res.statusText})`);
    }
    return (await res.json()) as NotebookItem;
  }

  /**
   * Lists all sources belonging to a given notebook with pagination.
   */
  async listSources(notebookId: string): Promise<SourceItem[]> {
    const all: SourceItem[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const res = await this.fetchFn(
        `${this.baseUrl}/api/sources?notebook_id=${encodeURIComponent(notebookId)}&limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );
      if (!res.ok) {
        throw new Error(`Failed to list sources for notebook '${notebookId}' (${res.status} ${res.statusText})`);
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || data.sources || []);
      for (const item of items) {
        all.push({
          id: item.id,
          title: item.title,
          url: item.asset?.url || item.url,
          created: item.created,
          updated: item.updated,
          ...item,
        });
      }
      if (items.length < limit) {
        break;
      }
      offset += limit;
    }

    return all;
  }

  /**
   * Creates a new source with text content.
   */
  async createSource(options: CreateSourceOptions): Promise<SourceItem> {
    const payload: any = {
      type: 'text',
      title: options.title,
      content: options.text,
      notebooks: [options.notebookId],
      async_processing: options.processAsync ?? false,
    };
    if (options.url) {
      payload.url = options.url;
    }

    const maxRetries = 4;
    let delay = 300;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await this.fetchFn(`${this.baseUrl}/api/sources/json`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          return (await res.json()) as SourceItem;
        }
        const errText = await res.text().catch(() => '');
        if (attempt < maxRetries && (res.status >= 500 || res.status === 429)) {
          await new Promise((r) => setTimeout(r, delay + Math.random() * 200));
          delay *= 2;
          continue;
        }
        throw new Error(`Failed to create source '${options.title}' (${res.status}: ${errText || res.statusText})`);
      } catch (err: any) {
        if (attempt < maxRetries && (!err.message || !err.message.startsWith('Failed to create source'))) {
          await new Promise((r) => setTimeout(r, delay + Math.random() * 200));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Failed to create source '${options.title}' after ${maxRetries} attempts`);
  }

  /**
   * Deletes a source by its ID.
   */
  async deleteSource(sourceId: string): Promise<boolean> {
    const maxRetries = 4;
    let delay = 300;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await this.fetchFn(`${this.baseUrl}/api/sources/${encodeURIComponent(sourceId)}`, {
          method: 'DELETE',
          headers: this.getHeaders(),
        });
        if (res.status === 404 || res.ok) return true;
        const errText = await res.text().catch(() => '');
        if (attempt < maxRetries && (res.status >= 500 || res.status === 429)) {
          await new Promise((r) => setTimeout(r, delay + Math.random() * 200));
          delay *= 2;
          continue;
        }
        throw new Error(`Failed to delete source '${sourceId}' (${res.status}: ${errText || res.statusText})`);
      } catch (err: any) {
        if (attempt < maxRetries && (!err.message || !err.message.startsWith('Failed to delete source'))) {
          await new Promise((r) => setTimeout(r, delay + Math.random() * 200));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
    return true;
  }

  /**
   * Polls the Open Notebook API until it is healthy or timeout is reached.
   */
  async waitForReady(timeoutMs = 30000, intervalMs = 1000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const healthy = await this.checkHealth();
      if (healthy) {
        return true;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  /**
   * Lists all configured AI provider credentials.
   */
  async listCredentials(): Promise<any[]> {
    const res = await this.fetchFn(`${this.baseUrl}/api/credentials`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list credentials (${res.status} ${res.statusText})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).items)) return (data as any).items;
    if (Array.isArray((data as any).credentials)) return (data as any).credentials;
    return [];
  }

  /**
   * Creates a new AI provider credential.
   */
  async createCredential(cred: {
    provider: string;
    name: string;
    key?: string;
    api_key?: string;
    base_url?: string;
  }): Promise<any> {
    const payload: any = {
      provider: cred.provider,
      name: cred.name,
      key: cred.key || cred.api_key || '',
    };
    if (cred.base_url) {
      payload.base_url = cred.base_url;
    }

    const res = await this.fetchFn(`${this.baseUrl}/api/credentials`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to create credential '${cred.name}' (${res.status}: ${errText || res.statusText})`);
    }
    return await res.json();
  }

  /**
   * Updates an existing AI provider credential.
   */
  async updateCredential(
    id: string,
    cred: { provider?: string; name?: string; key?: string; api_key?: string; base_url?: string }
  ): Promise<any> {
    const payload: any = {};
    if (cred.provider) payload.provider = cred.provider;
    if (cred.name) payload.name = cred.name;
    if (cred.key || cred.api_key) payload.key = cred.key || cred.api_key;
    if (cred.base_url) payload.base_url = cred.base_url;

    const res = await this.fetchFn(`${this.baseUrl}/api/credentials/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to update credential '${id}' (${res.status}: ${errText || res.statusText})`);
    }
    return await res.json();
  }

  /**
   * Discovers available models for a given credential.
   */
  async discoverModels(credentialId: string): Promise<string[]> {
    const res = await this.fetchFn(
      `${this.baseUrl}/api/credentials/${encodeURIComponent(credentialId)}/discover`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Failed to discover models for credential '${credentialId}' (${res.status}: ${errText || res.statusText})`
      );
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((m) => (typeof m === 'string' ? m : m.id || m.name || String(m)));
    }
    if (Array.isArray((data as any).models)) {
      return (data as any).models.map((m: any) => (typeof m === 'string' ? m : m.id || m.name || String(m)));
    }
    return [];
  }

  /**
   * Registers discovered models with Open Notebook.
   */
  async registerModels(credentialId: string, modelIds: string[]): Promise<any> {
    const res = await this.fetchFn(
      `${this.baseUrl}/api/credentials/${encodeURIComponent(credentialId)}/register-models`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ model_ids: modelIds }),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Failed to register models for credential '${credentialId}' (${res.status}: ${errText || res.statusText})`
      );
    }
    return await res.json();
  }

  /**
   * Lists all models currently registered in Open Notebook.
   */
  async listModels(): Promise<any[]> {
    const res = await this.fetchFn(`${this.baseUrl}/api/models`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list models (${res.status} ${res.statusText})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).items)) return (data as any).items;
    if (Array.isArray((data as any).models)) return (data as any).models;
    return [];
  }

  /**
   * Retrieves the current default model assignments.
   */
  async getDefaultModels(): Promise<Record<string, string | null>> {
    let res = await this.fetchFn(`${this.baseUrl}/api/models/defaults`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (res.status === 404) {
      res = await this.fetchFn(`${this.baseUrl}/models/defaults`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
    }
    if (!res.ok) {
      throw new Error(`Failed to get default models (${res.status} ${res.statusText})`);
    }
    return (await res.json()) as Record<string, string | null>;
  }

  /**
   * Sets or updates default model assignments for service slots.
   */
  async setDefaultModels(defaults: Record<string, string | null>): Promise<any> {
    let res = await this.fetchFn(`${this.baseUrl}/api/models/defaults`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(defaults),
    });
    if (res.status === 404) {
      res = await this.fetchFn(`${this.baseUrl}/models/defaults`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(defaults),
      });
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to set default models (${res.status}: ${errText || res.statusText})`);
    }
    return await res.json().catch(() => ({}));
  }
}
