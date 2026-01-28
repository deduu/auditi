/**
 * API module for LLM connections.
 */
import client from './client';

export const getLLMConnections = async () => {
    const response = await client.get('/llm-connections');
    return response;
};

export const createLLMConnection = async (data) => {
    const response = await client.post('/llm-connections', data);
    return response;
};

export const deleteLLMConnection = async (connectionId) => {
    const response = await client.delete(`/llm-connections/${connectionId}`);
    return response;
};

export const getDefaultModel = async () => {
    const response = await client.get('/llm-connections/default/model');
    return response;
};

export const setDefaultModel = async (data) => {
    const response = await client.put('/llm-connections/default/model', data);
    return response;
};
