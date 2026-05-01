type Primitive = string | number | boolean | null;

type WhereConstraint = {
  kind: 'where';
  field: string;
  op: string;
  value: Primitive;
};

type OrderConstraint = {
  kind: 'orderBy';
  field: string;
  direction: 'asc' | 'desc';
};

type LimitConstraint = {
  kind: 'limit';
  value: number;
};

type QueryConstraint = WhereConstraint | OrderConstraint | LimitConstraint;

type CollectionRef = {
  type: 'collection';
  path: string;
};

type DocumentRef = {
  type: 'doc';
  path: string;
  id: string;
};

type QueryRef = {
  type: 'query';
  collection: CollectionRef;
  constraints: QueryConstraint[];
};

type SnapshotDoc = {
  id: string;
  data: () => Record<string, any>;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DataErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export const db = {
  mode: 'json-backend',
};

const API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function withApiBase(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!API_BASE_URL) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export function handleDataError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: DataErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      tokenExists: Boolean(localStorage.getItem('arenahub_token')),
    },
    operationType,
    path,
  };
  console.error('Data API Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function getAuthToken(): string | null {
  return localStorage.getItem('arenahub_token');
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(withApiBase(path), { ...init, headers });
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) errorMessage = payload.error;
    } catch {
      // Ignore parse error and keep fallback message.
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) return null;
  return response.json();
}

function toSnapshotDoc(item: Record<string, any>): SnapshotDoc {
  return {
    id: item.id,
    data: () => {
      const { id, ...rest } = item;
      return rest;
    },
  };
}

async function fetchDocs(ref: CollectionRef | QueryRef): Promise<Record<string, any>[]> {
  const collectionPath = ref.type === 'query' ? ref.collection.path : ref.path;
  const params = new URLSearchParams();

  if (ref.type === 'query') {
    ref.constraints.forEach((constraint) => {
      if (constraint.kind === 'where') {
        params.append('whereField', constraint.field);
        params.append('whereOp', constraint.op);
        params.append('whereValue', String(constraint.value));
      }
      if (constraint.kind === 'orderBy') {
        params.set('orderBy', constraint.field);
        params.set('orderDir', constraint.direction);
      }
      if (constraint.kind === 'limit') {
        params.set('limit', String(constraint.value));
      }
    });
  }

  const qs = params.toString();
  const url = qs ? `/api/collections/${collectionPath}?${qs}` : `/api/collections/${collectionPath}`;
  const payload = await apiRequest(url, { method: 'GET' });
  return Array.isArray(payload?.docs) ? payload.docs : [];
}

function subscribeCollection(ref: CollectionRef | QueryRef, next: (snapshot: any) => void, error?: (err: unknown) => void) {
  let stopped = false;
  let previous = '';

  const run = async () => {
    if (stopped) return;
    try {
      const docs = await fetchDocs(ref);
      const serialized = JSON.stringify(docs);
      if (serialized !== previous) {
        previous = serialized;
        next({
          docs: docs.map(toSnapshotDoc),
          empty: docs.length === 0,
        });
      }
    } catch (err) {
      if (error) error(err);
      else console.error(err);
    }
  };

  run();
  const timer = window.setInterval(run, 2500);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

function subscribeDoc(ref: DocumentRef, next: (snapshot: any) => void, error?: (err: unknown) => void) {
  let stopped = false;
  let previous = '';

  const run = async () => {
    if (stopped) return;
    try {
      const payload = await apiRequest(`/api/collections/${ref.path}/${ref.id}`, { method: 'GET' });
      const docData = payload?.doc || null;
      const serialized = JSON.stringify(docData || {});
      if (serialized !== previous) {
        previous = serialized;
        next({
          id: ref.id,
          exists: () => Boolean(docData),
          data: () => {
            if (!docData) return undefined;
            const { id, ...rest } = docData;
            return rest;
          },
        });
      }
    } catch (err) {
      if (error) error(err);
      else console.error(err);
    }
  };

  run();
  const timer = window.setInterval(run, 2500);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

export function collection(_db: any, path: string): CollectionRef {
  return { type: 'collection', path };
}

export function doc(_dbOrCollection: any, pathOrId: string, maybeId?: string): DocumentRef {
  if (typeof maybeId === 'string') {
    return { type: 'doc', path: pathOrId, id: maybeId };
  }
  const collectionRef = _dbOrCollection as CollectionRef;
  return { type: 'doc', path: collectionRef.path, id: pathOrId };
}

export function query(source: CollectionRef, ...constraints: QueryConstraint[]): QueryRef {
  return {
    type: 'query',
    collection: source,
    constraints,
  };
}

export function where(field: string, op: string, value: Primitive): WhereConstraint {
  return { kind: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderConstraint {
  return { kind: 'orderBy', field, direction };
}

export function limit(value: number): LimitConstraint {
  return { kind: 'limit', value };
}

export function onSnapshot(
  ref: CollectionRef | QueryRef | DocumentRef,
  next: (snapshot: any) => void,
  error?: (err: unknown) => void,
) {
  if (ref.type === 'doc') {
    return subscribeDoc(ref, next, error);
  }
  return subscribeCollection(ref, next, error);
}

export async function addDoc(collectionRef: CollectionRef, data: Record<string, any>) {
  const payload = await apiRequest(`/api/collections/${collectionRef.path}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return { id: payload.doc.id };
}

export async function updateDoc(docRef: DocumentRef, data: Record<string, any>) {
  await apiRequest(`/api/collections/${docRef.path}/${docRef.id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteDoc(docRef: DocumentRef) {
  await apiRequest(`/api/collections/${docRef.path}/${docRef.id}`, {
    method: 'DELETE',
  });
}

export async function setDoc(docRef: DocumentRef, data: Record<string, any>, options?: { merge?: boolean }) {
  await apiRequest(`/api/collections/${docRef.path}/${docRef.id}`, {
    method: 'PUT',
    body: JSON.stringify({ data, merge: Boolean(options?.merge) }),
  });
}

export async function getDoc(docRef: DocumentRef) {
  try {
    const payload = await apiRequest(`/api/collections/${docRef.path}/${docRef.id}`, {
      method: 'GET',
    });
    const docData = payload?.doc || null;
    return {
      id: docRef.id,
      exists: () => Boolean(docData),
      data: () => {
        if (!docData) return undefined;
        const { id, ...rest } = docData;
        return rest;
      },
    };
  } catch {
    return {
      id: docRef.id,
      exists: () => false,
      data: () => undefined,
    };
  }
}

export async function getDocs(ref: CollectionRef | QueryRef) {
  const docs = await fetchDocs(ref);
  return {
    docs: docs.map(toSnapshotDoc),
    empty: docs.length === 0,
  };
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export function increment(value: number) {
  return { __op: 'increment', by: value };
}

export const Timestamp = {
  now: () => ({ toDate: () => new Date() }),
};
