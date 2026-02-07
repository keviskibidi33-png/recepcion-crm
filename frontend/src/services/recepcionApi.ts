import axios from 'axios';
import { RecepcionMuestraData } from '../types/recepcionTypes';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.geofal.com.pe/api/ordenes';

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const recepcionApi = {
    listar: async (skip = 0, limit = 100): Promise<RecepcionMuestraData[]> => {
        const response = await api.get('/', { params: { skip, limit } });
        return response.data;
    },

    obtener: async (id: number): Promise<RecepcionMuestraData> => {
        const response = await api.get(`/${id}`);
        return response.data;
    },

    crear: async (data: Partial<RecepcionMuestraData>): Promise<RecepcionMuestraData> => {
        const response = await api.post('/', data);
        return response.data;
    },

    eliminar: async (id: number): Promise<void> => {
        await api.delete(`/${id}`);
    },

    descargarExcel: async (id: number, numeroOt: string): Promise<void> => {
        const response = await api.get(`/${id}/excel`, {
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
        // Ensure we strip /api/ordenes and any trailing slash from the base to get the root
        const rootUrl = API_BASE_URL.replace(/\/api\/ordenes\/?$/, '').replace(/\/$/, '');
        const response = await axios.get(`${rootUrl}/clientes`, { params: { search } });
        return response.data;
    },

    // --- PLANTILLAS DE PROYECTO ---
    buscarPlantillas: async (q: string): Promise<any[]> => {
        const response = await api.get('/plantillas/buscar', { params: { q } });
        return response.data;
    },

    crearPlantilla: async (data: any): Promise<any> => {
        const response = await api.post('/plantillas', data);
        return response.data;
    }
};
