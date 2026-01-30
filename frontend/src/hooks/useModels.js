
import { useState, useEffect, useCallback } from "react";
import api from "../api";

export const useModels = () => {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchModels = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getModels();
            setModels(data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch models:", err);
            setError("Failed to load models");
            
            // Fallback (for now) if API fails
            setModels([
                { name: "gpt-4", status: "active" },
                { name: "gpt-4o", status: "active" },
                { name: "claude-3-opus", status: "active" }
            ]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    return { models, loading, error, refetch: fetchModels };
};
