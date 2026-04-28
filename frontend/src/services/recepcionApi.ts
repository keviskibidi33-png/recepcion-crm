import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { RecepcionMuestraData } from '../types/recepcionTypes';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_REFRESH_TIMEOUT_MS = 2500;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

type AuthenticatedRequestConfig = InternalAxiosRequestConfig & {
    _authRetried?: boolean;
};

const api = axios.create({
    baseURL: API_BASE_URL,
});

const getStoredToken = (): string | null => {
    if (typeof window === 'undefined') return null;

    const token = localStorage.getItem('token')?.trim();
    return token ? token : null;
};

const persistToken = (token: string | null) => {
    if (typeof window === 'undefined') return;

    if (token) {
        localStorage.setItem('token', token);
        return;
    }

    localStorage.removeItem('token');
};

const decodeJwtExp = (token: string | null): number | null => {
    if (!token) return null;

    try {
        const [, payload] = token.split('.');
        if (!payload) return null;

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const decoded = JSON.parse(window.atob(padded));

        return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null;
    } catch {
        return null;
    }
};

const isTokenExpiringSoon = (token: string | null, skewMs = TOKEN_EXPIRY_SKEW_MS): boolean => {
    const exp = decodeJwtExp(token);
    if (!exp) return !token;
    return exp <= Date.now() + skewMs;
};

const requestTokenFromParent = async (reason: string): Promise<string | null> => {
    const existingToken = getStoredToken();

    if (typeof window === 'undefined' || window.parent === window) {
        return existingToken;
    }

    const requestId = `recepcion-${reason}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve) => {
        let settled = false;

        const cleanup = () => {
            window.removeEventListener('message', onMessage);
            clearTimeout(timeoutId);
        };

        const finish = (token: string | null) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (token) persistToken(token);
            resolve(token ?? getStoredToken());
        };

        const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== 'TOKEN_REFRESH') return;

            const responseRequestId = typeof event.data?.requestId === 'string' ? event.data.requestId : null;
            if (responseRequestId && responseRequestId !== requestId) return;

            const token = typeof event.data?.token === 'string' && event.data.token.trim()
                ? event.data.token.trim()
                : null;

            finish(token);
        };

        const timeoutId = window.setTimeout(() => {
            finish(existingToken);
        }, TOKEN_REFRESH_TIMEOUT_MS);

        window.addEventListener('message', onMessage);

        try {
            window.parent.postMessage(
                {
                    type: 'TOKEN_REFRESH_REQUEST',
                    requestId,
                    source: 'recepcion-api',
                    reason,
                },
                '*'
            );
        } catch {
            finish(existingToken);
        }
    });
};

const resolveAccessToken = async (reason: string): Promise<string | null> => {
    const storedToken = getStoredToken();
    if (!isTokenExpiringSoon(storedToken)) {
        return storedToken;
    }

    const refreshedToken = await requestTokenFromParent(reason);
    return refreshedToken ?? storedToken;
};

// Interceptor to attach auth token on every request
api.interceptors.request.use(
    async (config) => {
        const token = await resolveAccessToken(`request:${config.method ?? 'get'}:${config.url ?? ''}`);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor to handle auth errors
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as AuthenticatedRequestConfig | undefined;

        if (error.response?.status === 401 && originalRequest && !originalRequest._authRetried) {
            originalRequest._authRetried = true;

            const refreshedToken = await requestTokenFromParent('401-retry');
            if (refreshedToken) {
                originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
                return api.request(originalRequest);
            }
        }

        if (error.response?.status === 401) {
            console.error('[Auth] Session expired — showing modal');
            window.dispatchEvent(new CustomEvent('session-expired'));
        }
        return Promise.reject(error);
    }
);

export const recepcionApi = {
    listar: async (skip = 0, limit = 100): Promise<RecepcionMuestraData[]> => {
        const response = await api.get('/api/recepcion/', { params: { skip, limit } });
        return response.data;
    },

    obtener: async (id: number): Promise<RecepcionMuestraData> => {
        const response = await api.get(`/api/recepcion/${id}`);
        return response.data;
    },

    crear: async (data: Partial<RecepcionMuestraData>): Promise<RecepcionMuestraData> => {
        const response = await api.post('/api/recepcion/', data);
        return response.data;
    },

    actualizar: async (id: number, data: Partial<RecepcionMuestraData>): Promise<RecepcionMuestraData> => {
        const response = await api.put(`/api/recepcion/${id}`, data);
        return response.data;
    },

    eliminar: async (id: number): Promise<void> => {
        await api.delete(`/api/recepcion/${id}`);
    },

    descargarExcel: async (id: number, numeroOt: string): Promise<void> => {
        const response = await api.get(`/api/recepcion/${id}/excel`, {
            responseType: 'blob',
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Recepcion_${numeroOt}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    buscarClientes: async (search: string): Promise<any> => {
        const response = await api.get('/clientes', { params: { search } });
        return response.data;
    },

    // --- PLANTILLAS DE PROYECTO ---
    buscarPlantillas: async (q: string): Promise<any[]> => {
        const response = await api.get('/api/recepcion/plantillas/buscar', { params: { q } });
        return response.data;
    },

    crearPlantilla: async (data: any): Promise<any> => {
        const response = await api.post('/api/recepcion/plantillas', data);
        return response.data;
    },

    validarEstado: async (numeroRecepcion: string): Promise<any> => {
        const response = await api.get(`/api/tracing/validate/${numeroRecepcion}`);
        return response.data;
    },

    buscarRecepcion: async (numeroRecepcion: string): Promise<any> => {
        const response = await api.get('/api/recepcion/buscar-recepcion', {
            params: { numero: numeroRecepcion },
        });
        return response.data;
    },

    obtenerCotizacionPorToken: async (token: string): Promise<any> => {
        try {
            const response = await api.get(`/api/cotizacion/by-token/${token}`);
            return response.data;
        } catch (error: any) {
            // 404 is expected when quote token does not exist; keep flow silent
            if (error?.response?.status === 404) {
                return { success: false, data: null, notFound: true };
            }
            console.error("Error fetching quote by token:", error);
            throw error;
        }
    },

    importarExcel: async (file: File): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/api/recepcion/importar-excel', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }
};
