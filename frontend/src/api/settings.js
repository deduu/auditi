
import client from './client';

export const getEvalSettings = async () => {
    const response = await client.get('/settings/eval');
    return response;
};

export const updateEvalSettings = async (settings) => {
    const response = await client.put('/settings/eval', settings);
    return response;
};

export const getUserSettings = async () => {
    const response = await client.get('/settings/user');
    return response;
};

export const updateUserSettings = async (updates) => {
    const response = await client.patch('/settings/user', updates);
    return response;
};
