import axios from 'axios';
import { RecepcionMuestraData } from '../types/recepcionTypes';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor to attach auth token on every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
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
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.error('[Auth] Unauthorized request - token may be expired');
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

    obtenerCotizacionPorToken: async (token: string): Promise<any> => {
        try {
            const response = await api.get(`/api/cotizacion/by-token/${token}`);
            return response.data;
        } catch (error) {
            console.error("Error fetching quote by token:", error);
            throw error;
        }
    }
};
