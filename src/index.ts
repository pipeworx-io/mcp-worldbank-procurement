interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * World Bank Procurement Notices MCP — global development tenders (keyless).
 *
 * Wraps the public, no-auth World Bank Procurement Notices search API:
 *   https://search.worldbank.org/api/v2/procnotices
 *
 * ~412,000 procurement notices for World Bank-financed projects across ~140
 * developing countries — invitations for bids, requests for expression of
 * interest, contract awards, general procurement notices, and prequalification
 * invitations. A procurement complement to the `worldbank-projects` pack
 * (which covers project financing/status, and whose tool names it deliberately
 * avoids — everything here is prefixed wb_procurement_).
 *
 * Verified API params (live-tested 2026-07-19):
 *   qterm             — full-text search
 *   project_ctry_name — country filter, matches plain names ("Kenya", "Somalia")
 *   notice_type       — exact label, e.g. "Contract Award", "Invitation for Bids"
 *   procurement_method_code — e.g. RFB, RFP, RFQ, INDV, QCBS, LCS, CQS, DIR
 *   id                — single-notice lookup (e.g. "OP00457469")
 *   rows / os         — page size / offset
 *   srt=noticedate&order=desc — newest first (matches API default)
 *   fl                — field list (trims payload)
 * Date-range filtering is NOT supported upstream (strdate/enddate are ignored),
 * so tools return newest-first and expose pagination instead.
 *
 * All tools return shaped, LLM-friendly objects (not raw API passthrough) and
 * never throw — failures resolve to { error, retry_hint }.
 */


const BASE = 'https://search.worldbank.org/api/v2/procnotices';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 8000;
const DETAIL_URL = 'https://projects.worldbank.org/en/projects-operations/procurement-detail/';

// Compact field list for list-style tools (detail fetches the full record).
const LIST_FIELDS = [
  'id',
  'notice_type',
  'notice_status',
  'noticedate',
  'submission_deadline_date',
  'submission_deadline_time',
  'project_ctry_name',
  'project_id',
  'project_name',
  'bid_reference_no',
  'bid_description',
  'procurement_group',
  'procurement_method_code',
  'procurement_method_name',
  'notice_lang_name',
].join(',');

const tools: McpToolExport['tools'] = [
  {
    name: 'wb_procurement_search',
    description:
      'Search World Bank procurement notices — tenders, invitations for bids, requests for expression of interest, contract awards, and general procurement notices for World Bank-financed international development projects in ~140 developing countries (Africa, Asia, Latin America, Middle East, Eastern Europe). ~412k notices, newest first. Full-text search plus filters: country, notice type, and procurement method (Request for Bids, Request for Proposals, consultant selection). Each result includes bid reference, project, deadline, and a public notice URL. Keyless, global multilateral source.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Full-text search over notices, e.g. "solar panels", "road construction", "water supply consultant". Omit to list the latest notices.',
        },
        country: {
          type: 'string',
          description:
            'Country filter — plain English name, e.g. "Kenya", "Somalia", "Bangladesh", "Brazil". Regional multi-country programs (e.g. "Eastern and Southern Africa") also match. Omit for worldwide.',
        },
        notice_type: {
          type: 'string',
          description:
            'Notice type filter. Accepts the label or a shorthand: "Invitation for Bids" (bids/ifb/tender), "Request for Expression of Interest" (eoi/reoi), "Contract Award" (award), "General Procurement Notice" (gpn), "Invitation for Prequalification" (prequalification).',
        },
        method: {
          type: 'string',
          description:
            'Procurement method filter — code or name: RFB (Request for Bids), RFP (Request for Proposals), RFQ (Request for Quotations), INDV (Individual Consultant Selection), QCBS (Quality and Cost-Based Selection), LCS (Least Cost Selection), CQS (Consultant Qualification Selection), DIR (Direct Selection).',
        },
        limit: {
          type: ['number', 'string'],
          description: 'Number of notices to return (1-50). Default 10.',
        },
        offset: {
          type: ['number', 'string'],
          description: 'Result offset for pagination. Default 0.',
        },
      },
    },
  },
  {
    name: 'wb_procurement_by_country',
    description:
      'List the latest World Bank procurement notices for one developing country — open tenders, invitations for bids, expressions of interest, and contract awards funded by World Bank international development projects there. Newest first with bid reference, project name, submission deadline, procurement method, and public notice URL. Useful for finding active bidding opportunities or recent government contract activity in countries across Africa, Asia, and Latin America. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          description: 'Country name (plain English), e.g. "Kenya", "Nigeria", "India", "Ukraine". Required.',
        },
        notice_type: {
          type: 'string',
          description:
            'Optional notice type: "Invitation for Bids", "Request for Expression of Interest", "Contract Award", "General Procurement Notice", or "Invitation for Prequalification" (shorthands like "bids", "eoi", "award" also accepted).',
        },
        limit: {
          type: ['number', 'string'],
          description: 'Number of notices to return (1-50). Default 15.',
        },
      },
      required: ['country'],
    },
  },
  {
    name: 'wb_procurement_awards',
    description:
      'Search World Bank contract awards — which contracts were awarded under World Bank-financed development projects (300k+ award notices across developing countries). Filter by full-text keyword and/or country to see recently awarded goods, civil works, and consulting contracts, each with project, bid reference, procurement method, award publication date, and a public notice URL (the notice detail page names the awarded supplier). Newest first. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Full-text keyword, e.g. "bridge construction", "audit services", "medical equipment". Optional.',
        },
        country: {
          type: 'string',
          description: 'Country name (plain English), e.g. "Kenya", "Ethiopia", "Vietnam". Optional.',
        },
        limit: {
          type: ['number', 'string'],
          description: 'Number of awards to return (1-50). Default 10.',
        },
        offset: {
          type: ['number', 'string'],
          description: 'Result offset for pagination. Default 0.',
        },
      },
    },
  },
  {
    name: 'wb_procurement_detail',
    description:
      'Fetch one World Bank procurement notice by its notice id (e.g. "OP00457469", from wb_procurement_search results). Returns the full record: notice type and status, project, country, bid reference, submission deadline, procurement method, contact person/organization/email/phone, the full notice text (bidding instructions, eligibility, award details for contract awards), and the public notice URL.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'World Bank procurement notice id, e.g. "OP00457469". Find ids via wb_procurement_search.',
        },
      },
      required: ['id'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'wb_procurement_search':
        return await search(args);
      case 'wb_procurement_by_country':
        return await byCountry(args);
      case 'wb_procurement_awards':
        return await awards(args);
      case 'wb_procurement_detail':
        return await detail(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return {
        error: `World Bank procurement API did not respond within ${TIMEOUT_MS / 1000}s.`,
        retry_hint: 'Transient upstream slowness — retry in a few seconds, or lower limit.',
      };
    }
    return {
      error: e instanceof Error ? e.message : String(e),
      retry_hint: 'Check argument values (see inputSchema) and retry; the API itself is keyless.',
    };
  }
}

// --- notice type / method normalization -------------------------------------

// Exact upstream labels (verified via notice_type_exact facet).
const NOTICE_TYPES = [
  'Contract Award',
  'Request for Expression of Interest',
  'Invitation for Bids',
  'General Procurement Notice',
  'Invitation for Prequalification',
];

function normalizeNoticeType(v: string): string {
  const s = v.trim().toLowerCase();
  const exact = NOTICE_TYPES.find((t) => t.toLowerCase() === s);
  if (exact) return exact;
  if (/award/.test(s)) return 'Contract Award';
  if (/prequal/.test(s)) return 'Invitation for Prequalification';
  if (/general|gpn/.test(s)) return 'General Procurement Notice';
  if (/expression|\beoi\b|reoi|interest/.test(s)) return 'Request for Expression of Interest';
  if (/bid|tender|invitation|\bifb\b|\bspn\b/.test(s)) return 'Invitation for Bids';
  return v.trim(); // pass through as given
}

// Verified codes seen in live data.
const METHOD_CODES = new Set(['RFB', 'RFP', 'RFQ', 'INDV', 'QCBS', 'LCS', 'CQS', 'DIR', 'CDS']);

function normalizeMethod(v: string): string {
  const s = v.trim();
  const up = s.toUpperCase();
  if (METHOD_CODES.has(up)) return up;
  const l = s.toLowerCase();
  if (/quotation/.test(l)) return 'RFQ';
  if (/proposal/.test(l)) return 'RFP';
  if (/request.*bid|^bids?$/.test(l)) return 'RFB';
  if (/individual/.test(l)) return 'INDV';
  if (/quality.*cost/.test(l)) return 'QCBS';
  if (/least.?cost/.test(l)) return 'LCS';
  if (/qualification/.test(l)) return 'CQS';
  if (/direct/.test(l)) return 'DIR';
  return up; // pass through as a code guess
}

const GROUP_LABELS: Record<string, string> = {
  CS: 'Consulting Services',
  GO: 'Goods',
  CW: 'Civil Works',
  NC: 'Non-consulting Services',
};

// --- shaping ----------------------------------------------------------------

type Raw = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function shapeNotice(r: Raw): Record<string, unknown> {
  const id = str(r.id);
  const group = str(r.procurement_group);
  return {
    id,
    type: str(r.notice_type),
    status: str(r.notice_status),
    published: str(r.noticedate),
    deadline: str(r.submission_deadline_date),
    deadline_time: str(r.submission_deadline_time),
    country: str(r.project_ctry_name),
    project_id: str(r.project_id),
    project_name: str(r.project_name),
    reference: str(r.bid_reference_no),
    description: str(r.bid_description),
    category: group ? (GROUP_LABELS[group] ?? group) : null,
    method: str(r.procurement_method_name) ?? str(r.procurement_method_code),
    language: str(r.notice_lang_name),
    url: id ? `${DETAIL_URL}${id}` : null,
  };
}

function stripHtml(s: string): string {
  return s
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// --- fetch ------------------------------------------------------------------

interface ApiResponse {
  total?: string | number;
  procnotices?: Raw[];
}

async function wbGet(params: Record<string, string | number | undefined>): Promise<ApiResponse> {
  const qs = new URLSearchParams({ format: 'json' });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}?${qs.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    const body = await res.text().then((b) => b.slice(0, 200)).catch(() => '');
    throw new Error(`World Bank procurement API: HTTP ${res.status} ${body}`.trim());
  }
  return (await res.json()) as ApiResponse;
}

function total(d: ApiResponse, fallback: number): number {
  const n = Number(d.total);
  return Number.isFinite(n) ? n : fallback;
}

// --- tools ------------------------------------------------------------------

async function search(args: Raw): Promise<unknown> {
  const query = strArg(args.query);
  const country = strArg(args.country);
  const noticeType = strArg(args.notice_type);
  const method = strArg(args.method);
  const limit = clampInt(args.limit, 10, 1, 50);
  const offset = clampInt(args.offset, 0, 0, 100000);

  const d = await wbGet({
    qterm: query,
    project_ctry_name: country,
    notice_type: noticeType ? normalizeNoticeType(noticeType) : undefined,
    procurement_method_code: method ? normalizeMethod(method) : undefined,
    rows: limit,
    os: offset,
    srt: 'noticedate',
    order: 'desc',
    fl: LIST_FIELDS,
  });
  const notices = (d.procnotices ?? []).map(shapeNotice);
  return {
    total: total(d, notices.length),
    count: notices.length,
    limit,
    offset,
    ...(query ? { query } : {}),
    ...(country ? { country } : {}),
    ...(noticeType ? { notice_type: normalizeNoticeType(noticeType) } : {}),
    ...(method ? { method: normalizeMethod(method) } : {}),
    notices,
  };
}

async function byCountry(args: Raw): Promise<unknown> {
  const country = strArg(args.country);
  if (!country) {
    return {
      error: 'wb_procurement_by_country requires "country" — a plain English country name like "Kenya".',
      retry_hint: 'Pass { country: "Kenya" } (optionally notice_type and limit).',
    };
  }
  const noticeType = strArg(args.notice_type);
  const limit = clampInt(args.limit, 15, 1, 50);

  const d = await wbGet({
    project_ctry_name: country,
    notice_type: noticeType ? normalizeNoticeType(noticeType) : undefined,
    rows: limit,
    srt: 'noticedate',
    order: 'desc',
    fl: LIST_FIELDS,
  });
  const notices = (d.procnotices ?? []).map(shapeNotice);
  return {
    country,
    ...(noticeType ? { notice_type: normalizeNoticeType(noticeType) } : {}),
    total: total(d, notices.length),
    count: notices.length,
    notices,
    ...(notices.length === 0
      ? { note: 'No matches — try the official English country name (e.g. "Tanzania", "Cote d\'Ivoire").' }
      : {}),
  };
}

async function awards(args: Raw): Promise<unknown> {
  const query = strArg(args.query);
  const country = strArg(args.country);
  const limit = clampInt(args.limit, 10, 1, 50);
  const offset = clampInt(args.offset, 0, 0, 100000);

  const d = await wbGet({
    qterm: query,
    project_ctry_name: country,
    notice_type: 'Contract Award',
    rows: limit,
    os: offset,
    srt: 'noticedate',
    order: 'desc',
    fl: LIST_FIELDS,
  });
  const notices = (d.procnotices ?? []).map(shapeNotice);
  return {
    notice_type: 'Contract Award',
    total: total(d, notices.length),
    count: notices.length,
    limit,
    offset,
    ...(query ? { query } : {}),
    ...(country ? { country } : {}),
    awards: notices,
    note: 'Awarded-supplier details are in each notice text — fetch via wb_procurement_detail(id).',
  };
}

async function detail(args: Raw): Promise<unknown> {
  const id = strArg(args.id);
  if (!id) {
    return {
      error: 'wb_procurement_detail requires "id" — a World Bank notice id like "OP00457469".',
      retry_hint: 'Find notice ids via wb_procurement_search, then pass { id: "OP..." }.',
    };
  }
  const d = await wbGet({ id: id.toUpperCase() });
  const r = (d.procnotices ?? [])[0];
  if (!r) {
    return {
      error: 'Notice not found.',
      id,
      retry_hint: 'Ids look like "OP00457469" — find them via wb_procurement_search.',
    };
  }
  const noticeText = str(r.notice_text);
  const text = noticeText ? stripHtml(noticeText) : null;
  return {
    ...shapeNotice(r),
    contact: {
      name: str(r.contact_name),
      organization: str(r.contact_organization),
      email: str(r.contact_email),
      phone: str(r.contact_phone_no),
      address: str(r.contact_address),
      country: str(r.contact_ctry_name),
    },
    notice_text: text && text.length > 4000 ? `${text.slice(0, 4000)}…` : text,
  };
}

// --- arg helpers ------------------------------------------------------------

function strArg(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function clampInt(v: unknown, dflt: number, min: number, max: number): number {
  let n: number;
  if (typeof v === 'number' && Number.isFinite(v)) n = Math.trunc(v);
  else if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) n = Math.trunc(Number(v));
  else return dflt;
  return Math.min(max, Math.max(min, n));
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
