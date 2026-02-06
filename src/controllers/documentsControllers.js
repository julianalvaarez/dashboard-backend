import { supabase } from '../utils/Supabase.js';

export const uploadDocument = async (req, res) => {
    const { player_id } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${player_id}/${Date.now()}.${fileExt}`;
        const filePath = fileName;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('player-documents')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return res.status(500).json({ error: "Error uploading to storage" });
        }

        const { data: { publicUrl } } = supabase.storage
            .from('player-documents')
            .getPublicUrl(filePath);

        const { data, error } = await supabase
            .from('documents')
            .insert([{
                player_id,
                name: file.originalname,
                url: publicUrl,
                supabase_path: filePath
            }])
            .select();

        if (error) {
            console.error("Database error:", error);
            // Cleanup storage if database insert fails
            await supabase.storage.from('player-documents').remove([filePath]);
            return res.status(500).json({ error: "Error saving document metadata" });
        }

        res.status(200).json(data[0]);
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: "Server error" });
    }
};

export const getDocumentsByPlayer = async (req, res) => {
    const { playerId } = req.params;

    try {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('player_id', playerId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

export const deleteDocument = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Get document info to find storage path
        const { data: doc, error: fetchError } = await supabase
            .from('documents')
            .select('supabase_path')
            .eq('id', id)
            .single();

        if (fetchError || !doc) {
            return res.status(404).json({ error: "Document not found" });
        }

        // 2. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('player-documents')
            .remove([doc.supabase_path]);

        if (storageError) {
            console.error("Storage delete error:", storageError);
            return res.status(500).json({ error: "Error deleting from storage" });
        }

        // 3. Delete from DB
        const { error: dbError } = await supabase
            .from('documents')
            .delete()
            .eq('id', id);

        if (dbError) {
            return res.status(500).json({ error: "Error deleting from database" });
        }

        res.json({ message: "Document deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};
