// Vasco API client for connecting to the backend
const API_BASE = process.env.EXPO_PUBLIC_VASCO_API_URL ?? '';

// CFO API endpoints
export const cfoApi = {
  async getRecommendation(contractId: string, proposedAmount: number) {
    const url = `${API_BASE}/recommendations/cfo/${contractId}?proposed_amount=${proposedAmount}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getSimilarOrders(description: string, topK = 5) {
    const params = new URLSearchParams({ description, top_k: String(topK) });
    const res = await fetch(`${API_BASE}/change_orders/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getIntegratedRecommendation(contractId: string, description: string, proposedAmount: number) {
    const res = await fetch(`${API_BASE}/change_orders/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_id: contractId,
        description,
        proposed_amount: proposedAmount,
        top_k: 3,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async trainAgent(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/agents/cfo/train`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getChangeOrderMetrics(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/metrics/change_orders`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getRoiMetrics(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/roi-metrics`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getSavingsFeed(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/savings/list`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getCostToComplete(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/cost_to_complete`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getVarianceMetrics(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/variance_metrics`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getDrawPackage(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/draw_package`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getInvoiceAnomalies(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/invoices/anomalies`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },
};

// COO API endpoints
export const cooApi = {
  async getRecommendations(projectId: string) {
    const res = await fetch(`${API_BASE}/recommendations/coo/${projectId}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async computeThreshold(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/agents/coo/train`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getRoiMetrics(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/coo-roi`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },
};

// Site Lead API endpoints
export const siteApi = {
  async logEvent(projectId: string, date: string, classification: string, notes?: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/site_events/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, classification, notes: notes || null }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getRecommendations(projectId: string) {
    const res = await fetch(`${API_BASE}/recommendations/site/${projectId}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async computeRules(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/agents/site/train`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getMetrics(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/metrics/site_events`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },

  async getRoiMetrics(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/site-roi`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
    return res.json();
  },
};
